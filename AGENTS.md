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
