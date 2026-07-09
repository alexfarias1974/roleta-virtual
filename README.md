# 🎡 Roleta Virtual Interativa

Roleta virtual altamente personalizável para uso em totens interativos (1080×1920 px), desenvolvida para eventos.

## ✨ Funcionalidades

- **Dashboard de configuração** completo com:
  - Upload de logomarca (PNG/JPG) com drag-and-drop
  - Definição de 1 a 10 prêmios com nomes e cores individuais
  - 4 paletas pré-definidas: Vibrantes, Pastéis, Clássicas e Neon
  - Upload de background personalizado ou cor sólida
  - Duração do giro configurável (3 a 10 segundos)
  - Pré-visualização em tempo real
- **Roleta animada** com:
  - Animação suave (quintic ease-out)
  - Efeito sonoro de tick a cada segmento cruzado
  - Modal de resultado com confetti
- **Página de estatísticas** com:
  - Total de sorteios
  - Contagem por prêmio
  - Gráficos de participantes por hora e por dia

## 🛠️ Tecnologias

- HTML5 + Vanilla CSS + Vanilla JavaScript (sem frameworks)
- Canvas API (roleta e gráficos)
- Web Audio API (efeitos sonoros)
- localStorage (100% local, sem banco de dados em nuvem)

## 🚀 Como usar

Abra o `index.html` diretamente no navegador, ou use o servidor local:

```powershell
powershell -ExecutionPolicy Bypass -File servidor.ps1
```

Acesse em: **http://localhost:8080**

## 📐 Resolução

Otimizado para **1080 × 1920 px** (totem portrait).

Para testar no Chrome: `F12 → ícone de dispositivo → resolução customizada 1080×1920`.
