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

conn.commit()
conn.close()