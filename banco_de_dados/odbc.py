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
cursor.execute("SELECT nome, nickname FROM participantes")

for row in cursor:
    print(row.nome, row.nickname)
    
conn.close()