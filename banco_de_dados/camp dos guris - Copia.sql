-- Correcao das nove tabelas originais. Execute o arquivo inteiro no pgAdmin.
-- Sem participantes ficticios, IDs fixos ou gerador de campeonatos.
BEGIN;
SET LOCAL search_path = public, pg_catalog;

CREATE TABLE IF NOT EXISTS participantes (
    id_participante SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    nickname VARCHAR(80),
    email VARCHAR(150),
    data_cadastro TIMESTAMP DEFAULT now(),
    ativo BOOLEAN DEFAULT true
);
CREATE TABLE IF NOT EXISTS modalidades (
    id_modalidade SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    tipo_disputa VARCHAR(50),
    ativo BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS campeonatos (
    id_campeonato SERIAL PRIMARY KEY,
    id_modalidade INTEGER NOT NULL REFERENCES modalidades(id_modalidade),
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    formato VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'rascunho',
    max_participantes INTEGER NOT NULL CHECK (max_participantes >= 2),
    tipo_inscricao VARCHAR(20) NOT NULL DEFAULT 'individual',
    data_inicio DATE,
    data_fim DATE,
    data_criacao TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inscricoes (
    id_inscricao SERIAL PRIMARY KEY,
    id_campeonato INTEGER NOT NULL REFERENCES campeonatos(id_campeonato),
    id_participante INTEGER NOT NULL REFERENCES participantes(id_participante),
    seed INTEGER,
    status VARCHAR(30) NOT NULL DEFAULT 'confirmada',
    data_inscricao TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (id_campeonato, id_participante)
);
CREATE TABLE IF NOT EXISTS regras_campeonato (
    id_regra SERIAL PRIMARY KEY,
    id_campeonato INTEGER NOT NULL UNIQUE REFERENCES campeonatos(id_campeonato) ON DELETE CASCADE,
    melhor_de INTEGER NOT NULL DEFAULT 3,
    limite_participantes INTEGER NOT NULL,
    permite_empate BOOLEAN NOT NULL DEFAULT false,
    criterio_desempate TEXT,
    observacoes TEXT
);
CREATE TABLE IF NOT EXISTS fases (
    id_fase SERIAL PRIMARY KEY,
    id_campeonato INTEGER NOT NULL REFERENCES campeonatos(id_campeonato) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    ordem INTEGER NOT NULL CHECK (ordem > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    UNIQUE (id_campeonato, ordem)
);
CREATE TABLE IF NOT EXISTS rodadas (
    id_rodada SERIAL PRIMARY KEY,
    id_fase INTEGER NOT NULL REFERENCES fases(id_fase) ON DELETE CASCADE,
    numero_rodada INTEGER NOT NULL CHECK (numero_rodada > 0),
    nome VARCHAR(100) NOT NULL,
    ordem INTEGER NOT NULL CHECK (ordem > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    UNIQUE (id_fase, numero_rodada)
);
CREATE TABLE IF NOT EXISTS partidas (
    id_partida SERIAL PRIMARY KEY,
    id_rodada INTEGER NOT NULL REFERENCES rodadas(id_rodada) ON DELETE CASCADE,
    id_inscricao_1 INTEGER REFERENCES inscricoes(id_inscricao),
    id_inscricao_2 INTEGER REFERENCES inscricoes(id_inscricao),
    vencedor_inscricao INTEGER REFERENCES inscricoes(id_inscricao),
    numero_partida INTEGER NOT NULL CHECK (numero_partida > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'agendada',
    data_partida TIMESTAMP,
    proxima_partida INTEGER REFERENCES partidas(id_partida) ON DELETE SET NULL,
    posicao_proxima_partida INTEGER CHECK (posicao_proxima_partida IN (1, 2)),
    UNIQUE (id_rodada, numero_partida)
);
CREATE TABLE IF NOT EXISTS resultados_partida (
    id_resultado SERIAL PRIMARY KEY,
    id_partida INTEGER NOT NULL UNIQUE REFERENCES partidas(id_partida) ON DELETE CASCADE,
    placar_lado_1 INTEGER NOT NULL DEFAULT 0 CHECK (placar_lado_1 >= 0),
    placar_lado_2 INTEGER NOT NULL DEFAULT 0 CHECK (placar_lado_2 >= 0),
    vencedor_lado INTEGER CHECK (vencedor_lado IN (1, 2)),
    observacoes TEXT,
    data_registro TIMESTAMP NOT NULL DEFAULT now()
);

-- Aplica tambem nas tabelas ja criadas: IF NOT EXISTS sozinho nao as corrige.
LOCK TABLE campeonatos, inscricoes, regras_campeonato, fases, rodadas, partidas,
    resultados_partida IN ACCESS EXCLUSIVE MODE;
ALTER TABLE partidas ALTER COLUMN id_inscricao_1 DROP NOT NULL;
ALTER TABLE partidas ADD COLUMN IF NOT EXISTS eh_bye BOOLEAN;
UPDATE partidas SET eh_bye = (id_inscricao_1 IS NOT NULL AND id_inscricao_2 IS NULL) WHERE eh_bye IS NULL;
ALTER TABLE partidas ALTER COLUMN eh_bye SET DEFAULT false;
ALTER TABLE partidas ALTER COLUMN eh_bye SET NOT NULL;
ALTER TABLE partidas DROP CONSTRAINT IF EXISTS partidas_solo_lados;
ALTER TABLE partidas ADD CONSTRAINT partidas_solo_lados CHECK (
    (id_inscricao_1 IS NULL OR id_inscricao_2 IS NULL OR id_inscricao_1 <> id_inscricao_2)
    AND (NOT eh_bye OR (id_inscricao_1 IS NOT NULL AND id_inscricao_2 IS NULL))
    AND (vencedor_inscricao IS NULL OR COALESCE(vencedor_inscricao = id_inscricao_1, false)
        OR COALESCE(vencedor_inscricao = id_inscricao_2, false))
);
ALTER TABLE regras_campeonato DROP CONSTRAINT IF EXISTS regras_melhor_de_valido;
ALTER TABLE regras_campeonato ADD CONSTRAINT regras_melhor_de_valido CHECK (melhor_de > 0 AND melhor_de % 2 = 1);
ALTER TABLE partidas DROP CONSTRAINT IF EXISTS partidas_destino_valido;
ALTER TABLE partidas ADD CONSTRAINT partidas_destino_valido CHECK (
    (proxima_partida IS NULL) = (posicao_proxima_partida IS NULL)
    AND (proxima_partida IS NULL OR proxima_partida <> id_partida)
);
ALTER TABLE partidas DROP CONSTRAINT IF EXISTS partidas_vaga_unica;
ALTER TABLE partidas ADD CONSTRAINT partidas_vaga_unica
    UNIQUE (proxima_partida, posicao_proxima_partida) DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION validar_limite_inscricoes()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
DECLARE limite INTEGER; total INTEGER;
BEGIN
    -- Atualizacao real serializa inscricoes concorrentes, mesmo em REPEATABLE READ.
    UPDATE campeonatos SET max_participantes = max_participantes
    WHERE id_campeonato = NEW.id_campeonato RETURNING max_participantes INTO limite;
    IF NOT FOUND THEN RAISE EXCEPTION 'Campeonato nao encontrado.'; END IF;
    IF NEW.status <> 'confirmada' THEN RETURN NEW; END IF;
    -- Repetir uma inscricao com ON CONFLICT nao ocupa outra vaga.
    IF EXISTS (SELECT FROM inscricoes WHERE id_campeonato = NEW.id_campeonato
        AND id_participante = NEW.id_participante AND status = 'confirmada') THEN RETURN NEW; END IF;
    SELECT count(*) INTO total FROM inscricoes
    WHERE id_campeonato = NEW.id_campeonato AND status = 'confirmada';
    IF total >= limite THEN RAISE EXCEPTION 'Limite atingido: % de % vagas ocupadas.', total, limite; END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER verificar_limite_inscricoes BEFORE INSERT OR UPDATE ON inscricoes
FOR EACH ROW EXECUTE FUNCTION validar_limite_inscricoes();

CREATE OR REPLACE FUNCTION conferir_limite_campeonato()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
    IF NEW.max_participantes < (SELECT count(*) FROM inscricoes
        WHERE id_campeonato = NEW.id_campeonato AND status = 'confirmada') THEN
        RAISE EXCEPTION 'O limite nao pode ser menor que a quantidade de inscritos.';
    END IF;
    UPDATE regras_campeonato SET limite_participantes = NEW.max_participantes
    WHERE id_campeonato = NEW.id_campeonato AND limite_participantes IS DISTINCT FROM NEW.max_participantes;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER conferir_limite_campeonato AFTER UPDATE OF max_participantes ON campeonatos
FOR EACH ROW EXECUTE FUNCTION conferir_limite_campeonato();

-- Mantem o campo antigo nas regras, mas a fonte do limite e o campeonato.
CREATE OR REPLACE FUNCTION copiar_limite_campeonato()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.melhor_de, NEW.permite_empate) IS DISTINCT FROM (OLD.melhor_de, OLD.permite_empate)
        AND EXISTS (SELECT FROM partidas p JOIN rodadas r USING (id_rodada)
            JOIN fases f USING (id_fase) WHERE f.id_campeonato = OLD.id_campeonato) THEN
        RAISE EXCEPTION 'As regras de disputa nao podem mudar depois de criar partidas.';
    END IF;
    SELECT max_participantes INTO NEW.limite_participantes FROM campeonatos
    WHERE id_campeonato = NEW.id_campeonato FOR SHARE;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER copiar_limite_campeonato BEFORE INSERT OR UPDATE ON regras_campeonato
FOR EACH ROW EXECUTE FUNCTION copiar_limite_campeonato();

-- Impede mover vinculos existentes para outro campeonato por engano.
CREATE OR REPLACE FUNCTION manter_vinculo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE campo TEXT;
BEGIN
    FOREACH campo IN ARRAY TG_ARGV LOOP
        IF to_jsonb(NEW)->campo IS DISTINCT FROM to_jsonb(OLD)->campo THEN
            RAISE EXCEPTION 'Nao altere o campo % de um registro existente em %.', campo, TG_TABLE_NAME;
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER manter_vinculo BEFORE UPDATE ON inscricoes FOR EACH ROW
EXECUTE FUNCTION manter_vinculo('id_inscricao', 'id_campeonato', 'id_participante');
CREATE OR REPLACE TRIGGER manter_vinculo BEFORE UPDATE ON fases FOR EACH ROW
EXECUTE FUNCTION manter_vinculo('id_fase', 'id_campeonato', 'tipo');
CREATE OR REPLACE TRIGGER manter_vinculo BEFORE UPDATE ON regras_campeonato FOR EACH ROW
EXECUTE FUNCTION manter_vinculo('id_campeonato');
CREATE OR REPLACE TRIGGER manter_vinculo BEFORE UPDATE ON rodadas FOR EACH ROW
EXECUTE FUNCTION manter_vinculo('id_rodada', 'id_fase', 'ordem');
CREATE OR REPLACE TRIGGER manter_vinculo BEFORE UPDATE ON partidas FOR EACH ROW
EXECUTE FUNCTION manter_vinculo('id_partida', 'id_rodada');
CREATE OR REPLACE TRIGGER manter_vinculo BEFORE UPDATE ON resultados_partida FOR EACH ROW
EXECUTE FUNCTION manter_vinculo('id_partida');

CREATE OR REPLACE FUNCTION conferir_partida_solo()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
DECLARE p partidas%ROWTYPE; resultado resultados_partida%ROWTYPE; campeonato INTEGER; vencedor INTEGER;
    fase INTEGER; ordem_rodada INTEGER;
BEGIN
    SELECT * INTO p FROM partidas WHERE id_partida = NEW.id_partida;
    IF NOT FOUND THEN RETURN NULL; END IF;
    SELECT f.id_campeonato, r.id_fase, r.ordem INTO campeonato, fase, ordem_rodada
    FROM rodadas r JOIN fases f USING (id_fase)
    WHERE r.id_rodada = p.id_rodada;
    IF EXISTS (SELECT FROM partidas outra WHERE outra.id_rodada = p.id_rodada
        AND outra.id_partida <> p.id_partida
        AND (p.id_inscricao_1 IN (outra.id_inscricao_1, outra.id_inscricao_2)
            OR p.id_inscricao_2 IN (outra.id_inscricao_1, outra.id_inscricao_2))) THEN
        RAISE EXCEPTION 'Um participante nao pode disputar duas partidas na mesma rodada.';
    END IF;
    IF EXISTS (SELECT FROM inscricoes WHERE id_inscricao IN (p.id_inscricao_1, p.id_inscricao_2)
        AND id_campeonato <> campeonato) THEN RAISE EXCEPTION 'Os competidores devem ser do mesmo campeonato da rodada.'; END IF;
    IF EXISTS (SELECT FROM partidas destino JOIN rodadas r ON r.id_rodada = destino.id_rodada
        JOIN fases f USING (id_fase) WHERE destino.id_partida = p.proxima_partida
        AND f.id_campeonato <> campeonato) THEN RAISE EXCEPTION 'A proxima partida pertence a outro campeonato.'; END IF;
    IF EXISTS (SELECT FROM partidas destino JOIN rodadas r ON r.id_rodada = destino.id_rodada
        WHERE destino.id_partida = p.proxima_partida AND (r.id_fase <> fase OR r.ordem <= ordem_rodada)) THEN
        RAISE EXCEPTION 'O destino deve estar em uma rodada posterior da mesma fase.';
    END IF;
    SELECT * INTO resultado FROM resultados_partida WHERE id_partida = p.id_partida;
    vencedor := CASE resultado.vencedor_lado WHEN 1 THEN p.id_inscricao_1 WHEN 2 THEN p.id_inscricao_2 END;
    IF p.vencedor_inscricao IS DISTINCT FROM vencedor THEN
        RAISE EXCEPTION 'O vencedor da partida deve ser definido pelo registro em resultados_partida.';
    END IF;
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS conferir_partida_solo ON partidas;
CREATE CONSTRAINT TRIGGER conferir_partida_solo AFTER INSERT OR UPDATE ON partidas
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION conferir_partida_solo();

CREATE OR REPLACE FUNCTION validar_resultado_solo()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
DECLARE p partidas%ROWTYPE; regras regras_campeonato%ROWTYPE; tipo_fase TEXT; necessario INTEGER;
BEGIN
    SELECT * INTO p FROM partidas WHERE id_partida = NEW.id_partida FOR UPDATE;
    SELECT rc.* INTO regras FROM regras_campeonato rc
    JOIN fases f ON f.id_campeonato = rc.id_campeonato JOIN rodadas r USING (id_fase)
    WHERE r.id_rodada = p.id_rodada;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cadastre a partida e as regras antes do resultado.'; END IF;
    SELECT f.tipo INTO tipo_fase FROM fases f JOIN rodadas r USING (id_fase) WHERE r.id_rodada = p.id_rodada;
    necessario := regras.melhor_de / 2 + 1;
    IF p.id_inscricao_1 IS NULL OR (NOT p.eh_bye AND p.id_inscricao_2 IS NULL) THEN
        RAISE EXCEPTION 'Os competidores ainda nao foram definidos.';
    END IF;
    IF NEW.placar_lado_1 < 0 OR NEW.placar_lado_2 < 0 THEN RAISE EXCEPTION 'Placar negativo.'; END IF;
    IF p.eh_bye THEN
        IF NEW.placar_lado_1 <> necessario OR NEW.placar_lado_2 <> 0 THEN
            RAISE EXCEPTION 'O placar do BYE deve ser % a 0.', necessario;
        END IF;
        NEW.vencedor_lado := 1;
    ELSIF NEW.placar_lado_1 = necessario AND NEW.placar_lado_2 < necessario THEN NEW.vencedor_lado := 1;
    ELSIF NEW.placar_lado_2 = necessario AND NEW.placar_lado_1 < necessario THEN NEW.vencedor_lado := 2;
    ELSIF regras.permite_empate AND tipo_fase = 'suico'
        AND NEW.placar_lado_1 < necessario AND NEW.placar_lado_2 < necessario THEN NEW.vencedor_lado := NULL;
    ELSE RAISE EXCEPTION 'Placar final invalido para uma melhor de %.', regras.melhor_de;
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER validar_resultado_solo BEFORE INSERT OR UPDATE ON resultados_partida
FOR EACH ROW EXECUTE FUNCTION validar_resultado_solo();

CREATE OR REPLACE FUNCTION sincronizar_vencedor_solo()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE partidas SET vencedor_inscricao = NULL, status = 'agendada' WHERE id_partida = OLD.id_partida;
    ELSE
        UPDATE partidas SET vencedor_inscricao = CASE NEW.vencedor_lado
            WHEN 1 THEN id_inscricao_1 WHEN 2 THEN id_inscricao_2 END, status = 'concluida'
        WHERE id_partida = NEW.id_partida;
    END IF;
    RETURN NULL;
END;
$$;
CREATE OR REPLACE TRIGGER sincronizar_vencedor_solo AFTER INSERT OR UPDATE OR DELETE ON resultados_partida
FOR EACH ROW EXECUTE FUNCTION sincronizar_vencedor_solo();

-- Serializa alteracoes do campeonato e protege partidas com resultado registrado.
CREATE OR REPLACE FUNCTION proteger_resultado_solo()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
DECLARE rodada INTEGER;
BEGIN
    rodada := CASE WHEN TG_OP = 'DELETE' THEN OLD.id_rodada ELSE NEW.id_rodada END;
    UPDATE campeonatos SET max_participantes = max_participantes
    WHERE id_campeonato = (SELECT f.id_campeonato FROM rodadas r JOIN fases f USING (id_fase)
        WHERE r.id_rodada = rodada);
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    IF TG_OP = 'UPDATE' AND OLD.proxima_partida IS NOT NULL AND NEW.proxima_partida IS NULL THEN
        NEW.posicao_proxima_partida := NULL;
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.id_inscricao_1, NEW.id_inscricao_2, NEW.eh_bye) IS DISTINCT FROM
        (OLD.id_inscricao_1, OLD.id_inscricao_2, OLD.eh_bye)
        AND EXISTS (SELECT FROM resultados_partida WHERE id_partida = OLD.id_partida) THEN
        RAISE EXCEPTION 'Remova o resultado antes de alterar os competidores.';
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER proteger_resultado_solo BEFORE INSERT OR UPDATE OR DELETE ON partidas
FOR EACH ROW EXECUTE FUNCTION proteger_resultado_solo();

INSERT INTO modalidades(nome, descricao, tipo_disputa)
VALUES ('Pokemon', 'Batalhas individuais', 'individual') ON CONFLICT (nome) DO NOTHING;
-- Confere os registros antigos pelas mesmas regras dos novos, sem apagar cadastros.
UPDATE campeonatos SET max_participantes = max_participantes;
UPDATE regras_campeonato SET limite_participantes = limite_participantes;
UPDATE partidas SET numero_partida = numero_partida;
UPDATE resultados_partida SET placar_lado_1 = placar_lado_1;
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;
SELECT 'As nove tabelas foram configuradas com sucesso.' AS resultado;
