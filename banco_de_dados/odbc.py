import os
import pyodbc

conn = pyodbc.connect(
    'DRIVER={SQL Server};'
    'SERVER=nome_do_servidor;'
    'DATABASE=nome_do_banco;'
    'UID=usuario;'
    'PWD=senha'
)

cursor = conn.cursor()
usuarios = [
    ("João Silva", "joao@example.com", "hash123", "criador")
    ("João Silva", "joao@example.com", "hash123", "criador")
    ("Admin System", "admin@example.com", "hash789", "admin")
]
cursor.executemany("INSERT INTO usuarios (nome, email, senha_hash, tipo_usuario) VALUES (?, ?, ?, ?)", usuarios)

modalidades = [
    ("Pokémon VGC", "Competição oficial Pokémon", "competitivo")
    ("Pokémon Casual", "Diversão entre amigos", "casual")
]
cursor.executemany("INSERT INTO modalidades (nome, descricao, tipo_disputa) VALUES (?, ?, ?)", modalidades)

campeonatos = [
    (1, 1, "Campeonato VGC 2024", "duplas", "planejamento", 64, "individual")
    (2, 2, "Torneio Casual Amigos", "individual", "em_progresso", 32, "individual")
]
cursor.executemany("INSERT INTO campeonatos (id_criador, id_modalidade, nome, formato, status, max_participantes, tipo_inscricao) VALUES (?, ?, ?, ?, ?, ?, ?)", campeonatos)

participantes = [
    ("Lucas Trainer", "LucasTrainer", "lucas@example.com")
    ("Ana Master", "AnaMaster", "ana@example.com")
    ("Carlos Expert", "CarlosExp", "carlos@example.com")
]
cursor.executemany("INSERT INTO participantes (nome, nickname, email) VALUES (?, ?, ?)", participantes)

inscrições = [
    (1, 1, "confirmada")
    (1, 2, "confirmada")
    (2, 3, "confirmada")
]
cursor.executemany("INSERT INTO inscricoes (id_campeonato, id_participante, status) VALUES (?, ?, ?)", inscrições)


cursor.execute("SELECT * FROM usuarios")
for row in cursor.fetchall():
    print(row)   

cursor.execute("SELECT id_usuario, nome, email FROM usuarios")
for row in cursor.fetchall():
    print(f"ID: {row.id_usuario}, Nome: {row.nome}, Email: {row.email}")

cursor.execute("""
    SELECT 
        id_usuario AS [ID do Usuário],
        nome AS [Nome Completo],
        tipo_usuario AS [Tipo]
    FROM usuarios
""")
for row in cursor.fetchall():
    print(f"ID: {row[0]}, Nome: {row[1]}, Tipo: {row[2]}")

cursor.execute("SELECT * FROM usuarios WHERE tipo_usuario = ?", ('criador',))
for row in cursor.fetchall():
    print(row)

cursor.execute("""
    SELECT * FROM campeonatos 
    WHERE status = ? AND max_participantes > ?
""", ('em_progresso', 30))
for row in cursor.fetchall():
    print(row)

cursor.execute("SELECT * FROM participantes WHERE nome LIKE ?", ('L%',))
for row in cursor.fetchall():
    print(row)

cursor.execute("SELECT nome, data_criacao FROM campeonatos ORDER BY nome ASC")
for row in cursor.fetchall():
    print(row)

cursor.execute("""
    SELECT * FROM campeonatos 
    WHERE data_inicio BETWEEN ? AND ?
""", ('2024-01-01', '2024-12-31'))
for row in cursor.fetchall():
    print(row)
    
cursor.execute("""
    UPDATE usuarios SET ativo = ? WHERE tipo_usuario = ?
""", (True, 'participante'))
conn.commit()
print(f"{cursor.rowcount} linha(s) atualizada(s).")

cursor.execute("DELETE FROM usuarios WHERE id_usuario = ?", (999,))
conn.commit()
print(f"{cursor.rowcount} linha(s) deletada(s).")

cursor.execute("DROP TABLE IF EXISTS tabela_temporaria")
conn.commit()

cursor.execute("ALTER TABLE usuarios ADD COLUMN telefone VARCHAR(20)")
conn.commit()

cursor.execute("""
    SELECT nome FROM usuarios 
    UNION 
    SELECT nome FROM participantes
""")
for row in cursor.fetchall():
    print(row)

cursor.execute("""
    SELECT email FROM usuarios 
    INTERSECT 
    SELECT email FROM participantes
""")
for row in cursor.fetchall():
    print(row)

cursor.execute("""
    SELECT nome FROM usuarios 
    EXCEPT 
    SELECT nome FROM participantes
""")
for row in cursor.fetchall():
    print(row)

cursor.execute("""
    SELECT id_participante, COALESCE(email, 'sem email') AS email 
    FROM participantes
""")
for row in cursor.fetchall():
    print(row)

cursor.execute("""
    SELECT 
        COUNT(*) AS total_campeonatos,
        AVG(max_participantes) AS media_participantes,
        MIN(max_participantes) AS minimo,
        MAX(max_participantes) AS maximo
    FROM campeonatos
""")
row = cursor.fetchone()
print(row)

conn.commit()
conn.close()