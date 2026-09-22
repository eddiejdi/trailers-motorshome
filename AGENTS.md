# AGENTS.md — Trailer 3D Studio

## Regras de Arquitetura

### Ferramenta não conhece projetos

O frontend (viewer 3D) é uma **ferramenta genérica**. Ele nunca deve ter lógica específica para um tipo de projeto (caixa, trailer, móvel, etc.).

**Como funciona:**
- O JSON do projeto contém a seção `geometry` com `parts[]` (vértices, posições, materiais)
- O frontend lê `geometry.parts` e renderiza — sem saber o que é "caixa" ou "trailer"
- Para novos tipos de projeto: muda o JSON, não o código do frontend

**Formato do JSON (`geometry`):**
```json
{
  "geometry": {
    "format": "parts",
    "material": { "type": "standard", "color": "#c9a86c", "roughness": 0.85 },
    "parts": [
      {
        "name": "Peça",
        "box": [largura, altura, profundidade],
        "position": [x, y, z],
        "rotation": [rx, ry, rz]
      }
    ]
  }
}
```

**O que NÃO fazer:**
- ❌ `if (proj.tipo === 'caixa') { ... }` no frontend
- ❌ Funções como `buildBoxFromProject`, `buildTrailerProject` no `main.js`
- ❌ Frontend hardcoded para formatos específicos

**O que fazer:**
- ✅ JSON descreve a geometria completa
- ✅ Frontend é um interpretador genérico de `geometry.parts`
- ✅ Novos formatos = novos JSONs, não novos `if`s

## HOOK (2026-09-11): Ferramenta NUNCA é o projeto

Regra dura, prioritária sobre qualquer conveniência de implementação:

- **NÃO persistir dados de projeto na aplicação.** Decisão de projeto (posição/quantidade de janelas e portas, vãos de parede, direção de abertura da porta, deixar/paredes/ferragens, armários, etc.) pertence **exclusivamente ao JSON do projeto**.
- O código da ferramenta **nunca** carrega a decisão de um trailer específico. Nada de editar `main.js`/`Windows.js`/`Body.js` para mudar o projeto do usuário.
- A ferramenta **só altera o projeto** (grava no JSON) e **renderiza o que o JSON descreve**. Toda abertura/vão/porta/janela/ferragem vira dado:
  ```json
  "structure": {
    "openings": {
      "left":  [ { "type": "window", "z": 0.20, "y": 1.20, "w": 0.50, "h": 0.50 } ],
      "right": [ { "type": "window", "z": -0.35, "y": 1.20, "w": 0.50, "h": 0.50 } ],
      "rear":  [ { "type": "door", "x": 0, "w": 0.62, "h": 1.60 } ]
    },
    "windows":  [ { "name": "Janela direita 1", "x": ... } ],
    "door":     { "wall": "rear", "x": 0, "hinge": "right", "open": "out" }
  }
  ```
- Ausência da seção = comportamento padrão da ferramenta (projetos legados continuam abrindo).
- Se o código atual ainda tiver decisão de projeto embutida (ex.: porta na traseira, vão lateral), migrar para JSON **antes** de evoluir aquele recurso.

### Hook de bloqueio local (pre-commit)

- Script: `hooks/no-project-hardcode-check.sh`
- Instalação local: `.git/hooks/pre-commit` chama o script automaticamente.
- O commit é bloqueado se o diff staged em `src/main.js`, `src/model/*` ou `src/constants/Dimensions.js` adicionar padrões de hardcode de projeto (ex.: `CABIN_RISE`, `cabinRise`, `_upsertUnderfloorTanksIntoProjectJson`, `geometry.kind`, `geometry.projectType`).

## HOOK (2026-09-18): Coordenadas ABSOLUTAS sempre (geolocalização)

Regra dura — **valores fixos no espaço do trailer**, nunca relativos a grupos intermediários:

- **`scene_layout.objects[].p` = coordenadas absolutas no root do trailer** (`coord: "trailer-world"`).
- **NÃO** usar posição relativa a `interior` com `interior.position.y = FLOOR_Y` (isso soma offset e “move sozinho”).
- **NÃO** “corrigir” Y no load/drag via `resolvePlacement` para itens de layout (`fixedLayout: true`).
- Spawn/anexar objetos de layout no **`trailer` root** (ou parent com origem 0,0,0 no trailer).
- Ao serializar: gravar `p` no frame do trailer (mundo local do root), não no parent visual.
- Ao aplicar JSON: `position.set(p[0], p[1], p[2])` **literal** — sem somar `FLOOR_Y`, `deck_top`, etc. no código.
- Constantes de chassi/longarina só servem para **escrever** o JSON do projeto; a ferramenta na leitura **não recalcula**.

**Errado:**
```js
interior.position.y = FLOOR_Y;
mesh.position.set(0, 0, 0); // “no chão” relativo → mundo = FLOOR_Y
obj.position.y += floorY - b.min.y; // auto-snap
```

**Certo:**
```js
interior.position.y = 0;
mesh.position.set(st.p[0], st.p[1], st.p[2]); // absoluto do JSON
// fixedLayout → resolvePlacement return
```
