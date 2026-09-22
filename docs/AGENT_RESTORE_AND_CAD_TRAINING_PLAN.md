# Plano de Retomada: Restauro do Agent, Validação Visual e Treino CAD

Data: 2026-09-17

## Objetivo

Restaurar o `trailer_engineer_agent` e o pipeline de correção/treino de forma robusta, evitando que o sistema apenas "zere auditoria" enquanto o projeto continua visualmente errado. O objetivo final é que o agent consiga revisar o exterior e o interior do trailer como um projeto CAD/arquitetônico coerente, corrigir problemas reais e alimentar o modelo com exemplos de boa engenharia.

## Estado Atual Observado

O projeto ajustado `Trailer-Nelcyr-Nardelli_rev33_all_gaps_applied.json` chegou a `Total: 0` na auditoria, mas a inspeção visual mostrou que ele não está correto.

Problemas observados:

- O `body` foi esticado para englobar tudo, criando um envelope retangular artificial.
- O mezanino deveria ser uma extensão/pod sobre a lança, não parte indistinta do corpo principal.
- O exterior não representa a silhueta real do trailer.
- O interior parece coerente por AABB, mas ainda não foi validado como layout arquitetônico.
- O critério `Total: 0` sozinho não serve como critério de qualidade.

## Decisão Técnica Principal

Não usar `body.L` como solução para tudo.

O projeto deve ter envelopes separados:

- `body`: corpo principal da caixa habitável.
- `mezzanine_envelope`: extensão frontal sobre a lança.
- `underfloor_envelope`: região técnica abaixo do piso para tanques/caibros.
- `chassis_envelope`: chassi/lança, separado da célula habitável.

O agent deve validar cada objeto contra o envelope correto, sem esconder problemas e sem transformar o trailer num retângulo gigante.

## Contrato Geométrico Proposto

### `dimensions.body`

Representa somente o corpo principal habitável.

Campos mínimos:

```json
{
  "L": 3.0,
  "W": 1.9,
  "H": 1.85,
  "x_min": -0.95,
  "x_max": 0.95,
  "z_min": -1.5,
  "z_max": 1.5
}
```

### `dimensions.mezzanine_envelope`

Representa o pod frontal / cama de casal sobre a lança.

```json
{
  "x_min": -0.95,
  "x_max": 0.95,
  "y_min": 0.47,
  "y_max": 2.47,
  "z_min": -3.56,
  "z_max": -1.40,
  "type": "front_pod_over_tongue"
}
```

### `dimensions.underfloor_envelope`

Representa a área técnica sob o piso principal.

```json
{
  "x_min": -0.65,
  "x_max": 0.65,
  "y_min": 0.0,
  "y_max": 0.47,
  "z_min": -0.75,
  "z_max": 0.75,
  "type": "tank_floor_module"
}
```

### `scene_layout.objects[*]`

Para exports novos, cada objeto deve preservar:

```json
{
  "p": [0, 0, 0],
  "world_p": [0, 0, 0],
  "parent_path": ["trailer", "interior", "bath"],
  "kind": "..."
}
```

Importante:

- `p` continua sendo posição local para reabrir corretamente no app.
- `world_p` é usado pela auditoria e pelo treino.
- `parent_path` permite reconstrução precisa quando o export antigo não tinha `kind`.

## Erros Que O Modelo Deve Aprender A Não Repetir

### Erro 1: Esticar `body` para passar auditoria

Errado:

```json
{
  "action": "resize_body",
  "target": "body",
  "L": 5.055
}
```

Correto:

```json
{
  "action": "mezzanine_envelope_module",
  "target": "Mezanino"
}
```

### Erro 2: Corrigir só AABB sem validar visual

Errado:

```text
Auditoria zerou, portanto está correto.
```

Correto:

```text
Auditoria zerou, mas planta/elevacao/render devem confirmar silhueta, circulação e encaixes.
```

### Erro 3: Tratar todos os problemas visuais como falso positivo

Errado:

```text
Mezanino fora do body é falso positivo.
```

Correto:

```text
Mezanino fora do body exige envelope próprio; se estiver fora também do envelope do mezanino, é erro real.
```

### Erro 4: Escrever semântica de engenharia no renderer JS

Errado:

```js
mesh.userData.kind = 'mezzanine-floor'
```

Correto:

```text
Renderer exporta geometria genérica; agent enriquece/infere semântica via catálogo, parent_path, nomes estáveis e contratos de projeto.
```

## Arquitetura Correta

### Camada 1: Frontend / Renderer

Responsabilidade:

- Renderizar.
- Editar visualmente.
- Exportar geometria fiel.
- Não conter regras de engenharia específicas do mezanino.

Mudanças recomendadas:

- `SaveService.serializeLayout()` deve exportar `world_p`.
- Exportar `parent_path` genérico.
- Exportar `geometry_hint` opcional para objetos sem catálogo.
- Não colocar regras de `mezzanine-floor`, `mezzanine-column` diretamente no `Interior.js`.

### Camada 2: Engineering Agent

Responsabilidade:

- Interpretar semanticamente o projeto.
- Validar envelopes.
- Detectar gaps reais.
- Separar geometria, documentação e sistemas.

Mudanças recomendadas:

- `body_envelope`, `mezzanine_envelope`, `underfloor_envelope`, `chassis_envelope`.
- Regra nova `GEO018`: `body` artificialmente expandido para englobar mezanino.
- Regra nova `GEO019`: mezanino fora de `mezzanine_envelope`.
- Regra nova `GEO020`: silhueta inválida corpo+pod.
- Regra nova `VIS001`: auditoria numérica zerada mas planta/elevacao violam layout esperado.

### Camada 3: Fixer Determinístico

Responsabilidade:

- Corrigir de forma reprodutível.
- Nunca escolher solução visualmente pior para zerar regra.

Ações canônicas:

- `mezzanine_fit_module`
- `tank_floor_module`
- `mezzanine_envelope_module`
- `bathroom_corner_joint_module`
- `window_in_envelope_module`
- `restore_body_envelope_module`

### Camada 4: Modelo / LLM

Responsabilidade:

- Classificar intenção.
- Escolher ação canônica.
- Explicar correção.
- Nunca emitir coordenadas livres quando há módulo canônico.

O modelo não deve ser treinado para resolver geometria por si só. Ele deve aprender a escolher o módulo correto e justificar o motivo.

### Camada 5: Validação Visual

Responsabilidade:

- Gerar planta XZ.
- Gerar elevação ZY.
- Gerar render 3D externo/interno.
- Bloquear aprovação se visual contradiz auditoria.

## Pipeline Proposto

### Fase 0: Congelar Base Boa/Atual

Arquivos de referência:

- `exports/Trailer-Nelcyr-Nardelli_rev25_organized.json`: base antes das correções recentes.
- `exports/Trailer-Nelcyr-Nardelli_rev32_strict_geometry.json`: primeira tentativa com geometria corrigida.
- `exports/Trailer-Nelcyr-Nardelli_rev33_all_gaps_applied.json`: não usar como base visual; usar como exemplo negativo.

Resultado esperado:

- Criar `exports/baselines/` com cópias nomeadas.
- Marcar `rev33` como `negative_example_audit_zero_visual_bad`.

### Fase 1: Corrigir Contrato de Export

Implementar:

- `world_p` no export.
- `parent_path` no export.
- `geometry_hint` para objetos sem catálogo.

Critério de aceite:

- Reimportar o mesmo JSON não altera posições.
- Auditor lê `world_p` e não confunde local/global.

### Fase 2: Reescrever Envelopes

Implementar:

- `dimensions.body` volta a representar corpo principal.
- Criar `dimensions.mezzanine_envelope`.
- Criar `dimensions.underfloor_envelope`.

Critério de aceite:

- Mezanino fora do body não zera automaticamente.
- Mezanino precisa estar dentro do `mezzanine_envelope`.
- Body não pode ser esticado para resolver mezanino.

### Fase 3: Auditoria Estrita Real

Implementar regras:

- `GEO018`: body artificialmente expandido.
- `GEO019`: objeto do mezanino fora do envelope do mezanino.
- `GEO020`: underfloor/tanques fora do envelope técnico.
- `VIS001`: divergência entre auditoria numérica e planta/elevacao.

Critério de aceite:

- `rev33` deve falhar, apesar de `Total: 0` anterior.
- O agent deve dizer que `rev33` é visualmente ruim.

### Fase 4: Fixer Determinístico

Implementar módulos:

- `restore_body_envelope_module`: desfaz body retangular gigante.
- `mezzanine_envelope_module`: cria/ajusta envelope do mezanino.
- `mezzanine_fit_module`: encaixa piso, vigas e colunas dentro do envelope correto.
- `tank_floor_module`: encaixa tanques no underfloor sem placa gigante.
- `bathroom_corner_joint_module`: resolve junta de paredes sem interpenetração.
- `window_in_envelope_module`: recua janelas para dentro do envelope correto.

Critério de aceite:

- O fixer nunca aumenta `body.L` para cobrir mezanino.
- Toda correção gera log com antes/depois de AABB.

### Fase 5: Validação Visual Automatizada

Implementar:

- Render de planta XZ.
- Render de elevação ZY.
- Render 3D externo isométrico.
- Render 3D interior/topo.

Observação operacional:

- Chrome headless falhou porque `/tmp` estava 100% cheio e GPU headless ficou instável.
- Usar perfil em `logs/chrome-profile-*` e flags `--disable-gpu`.
- Se Chrome falhar, usar renderer AABB `scripts/render_aabb_views.py` como fallback de diagnóstico, mas não como aprovação final.

Critério de aceite:

- Imagens anexadas no log.
- Uma validação visual humana/LLM marca exterior e interior como coerentes.
- Se auditoria zera mas render está ruim, falha.

### Fase 6: Dataset e Treino

Gerar dataset com pares positivos e negativos.

Exemplo positivo:

```json
{
  "messages": [
    {"role":"user", "content":"O mezanino está fora do body; corrija."},
    {"role":"assistant", "content":"{\"action\":\"mezzanine_envelope_module\",\"target\":\"Mezanino\"}"}
  ]
}
```

Exemplo negativo:

```json
{
  "messages": [
    {"role":"user", "content":"O mezanino está fora do body; posso aumentar body.L?"},
    {"role":"assistant", "content":"{\"action\":\"noop\",\"target\":\"body\",\"reason\":\"Não aumentar body para mascarar mezanino; usar mezzanine_envelope_module.\"}"}
  ]
}
```

Categorias mínimas:

- `intent_to_module`: escolher ação canônica.
- `negative_bad_fix`: detectar solução ruim.
- `visual_validation`: auditoria zero mas visual ruim.
- `envelope_contract`: body vs mezzanine vs underfloor.
- `legacy_export`: `kind:null`, `p` local e `world_p` ausente.

Critério de aceite:

- Modelo escolhe `mezzanine_envelope_module` quando mezanino estoura body.
- Modelo rejeita `resize_body` como solução.
- Modelo pede validação visual antes de declarar sucesso.

## Fontes Online Pesquisadas Para CAD / Treino

### ABC CAD Dataset

URL: `https://deep-geometry.github.io/abc-dataset/`

Utilidade:

- 1 milhão de modelos CAD.
- Formatos STEP, Parasolid, STL, OBJ, features, stats, FeatureScript.
- Bom para aprender geometria B-Rep, superfícies, curvas e features.

Uso recomendado:

- Baixar subconjuntos pequenos de STEP/OBJ/stats.
- Extrair AABB, relações de contato, normal/curvatura, operações.
- Não usar diretamente para RV layout; usar para pré-treino geométrico geral.

Risco:

- Licenciamento depende dos criadores/Onshape Terms.
- Muito grande; baixar só chunks amostrais.

### Fusion 360 Gallery Dataset

URL: `https://github.com/AutodeskAILab/Fusion360GalleryDataset`

Utilidade:

- Dados de CAD paramétrico derivados de designs Fusion 360.
- Assembly dataset: 8.251 assemblies / 154.468 parts.
- Joint dataset: 32.148 joints.
- Reconstruction dataset: 8.625 sequências.
- Segmentation dataset: 35.680 parts.

Uso recomendado:

- Priorizar Assembly e Joint para aprender contato/suporte/encaixe.
- Usar Reconstruction para exemplos de sequência de construção.
- Usar Extended STEP para exemplos CAD reais.

Risco:

- Dataset grande.
- Requer pipeline para converter STEP/assembly graph em exemplos do nosso schema.

### DeepCAD / Onshape

URL: `https://github.com/rundiwu/DeepCAD`

Utilidade:

- Modelagem generativa de sequências CAD.
- Usa CAD JSON parseado de Onshape.
- Exporta STEP.
- Bom para aprender representação vetorial de comandos CAD.

Uso recomendado:

- Não usar para layout RV diretamente.
- Usar como inspiração de formato de sequência paramétrica.
- Aproveitar parser Onshape se quisermos transformar documentos CAD públicos em dados.

Risco:

- Código antigo: Python 3.7 / PyTorch 1.5.
- Melhor usar como referência conceitual, não como dependência direta.

### SketchGraphs

URL: `https://github.com/PrincetonLIPS/SketchGraphs`

Utilidade:

- 15 milhões de sketches CAD com grafos de restrições geométricas.
- Excelente para aprender relações como coincidência, paralelismo, perpendicularidade, tangência e distância.

Uso recomendado:

- Treinar/gerar exemplos de constraints 2D.
- Bom para ensinar que piso/parede devem formar 90 graus e faces devem coincidir.

Risco:

- Dados grandes: raw ~43GB; sequência filtrada também grande.
- Usar splits filtrados ou amostras.

### GrabCAD Community Library

URL: `https://grabcad.com/library`

Utilidade:

- Muitos modelos CAD prontos, incluindo trailers, chassis, móveis e componentes.

Uso recomendado:

- Usar manualmente para buscar referências de trailer/camper/chassis.
- Baixar apenas modelos com licença adequada.
- Transformar em exemplos de validação, não pré-treino massivo.

Risco:

- Requer JavaScript/login em muitas páginas.
- Licenças variam por usuário.

### 3D Warehouse

URL: `https://3dwarehouse.sketchup.com/search/?q=camper%20trailer`

Utilidade:

- Modelos SketchUp de campers, trailers, interiores e mobiliário.

Uso recomendado:

- Fonte visual/arquitetônica para silhueta e layout.
- Converter SKP/DAE/OBJ quando licença permitir.

Risco:

- Site exige JavaScript.
- Modelos podem ser artísticos, não construtivos.

### TraceParts

URL: `https://www.traceparts.com/`

Utilidade:

- Componentes CAD industriais: perfis, dobradiças, fechos, conectores, materiais, tubos.

Uso recomendado:

- Componentes reais para paleta: perfis U, barras, dobradiças, fechos, conexões elétricas/hidráulicas.

Risco:

- Melhor para peças/componentes, não trailer completo.

## Estratégia De Dataset Própria

O melhor dataset para este projeto não é só baixar CADs prontos. É gerar dados supervisionados a partir de:

- versões boas do nosso próprio JSON;
- versões ruins reais produzidas pelo agent;
- screenshots/planta/elevacao rotuladas;
- modelos CAD externos usados como referência.

### Exemplo De Registro De Treino Recomendado

```json
{
  "id": "negative_rev33_body_stretched",
  "input": {
    "project": "rev33_all_gaps_applied.json",
    "audit": "0 gaps",
    "visual": ["rev33_plan_xz.png", "rev33_elevation_zy.png"]
  },
  "expected": {
    "status": "reject",
    "reason": "body foi esticado para englobar mezanino; silhueta externa incorreta",
    "action": "restore_body_envelope_module"
  }
}
```

## Critérios De Aceite Final

Um projeto só pode ser considerado correto quando todos os critérios passarem:

- Auditoria geométrica: 0 gaps críticos/altos reais.
- Auditoria documental: sem gaps obrigatórios para a fase atual.
- Planta XZ coerente: body principal separado de mezanino/lança.
- Elevação ZY coerente: piso, vigas, colunas, janelas e banheiro sem colisões visíveis.
- Render 3D externo coerente: silhueta não vira caixa gigante.
- Render 3D interno coerente: circulação e uso fazem sentido.
- O modelo/fixer não alterou `body` para mascarar objetos fora.
- Toda correção tem log antes/depois.

## Próxima Atividade Recomendada

1. Criar `dimensions.mezzanine_envelope` e `dimensions.underfloor_envelope` no JSON base.
2. Reverter `body` do `rev33` para corpo principal e salvar `rev34_envelope_split.json`.
3. Atualizar `trailer_engineer_agent.py` para validar envelopes separados.
4. Adicionar `GEO018`, `GEO019`, `GEO020`, `VIS001`.
5. Atualizar `apply_model_fixes.py` para usar módulos separados.
6. Gerar imagens de validação em planta/elevacao/render.
7. Criar dataset com `rev33` como exemplo negativo.
8. Só depois treinar `trailer3d-assistant:candidate` no .2.

## Arquivos Que Devem Ser Prioridade Na Retomada

- `/workspace/eddie-auto-dev/specialized_agents/trailer_engineer_agent.py`
- `/home/edenilson/trailers-motorshome/scripts/apply_model_fixes.py`
- `/home/edenilson/trailers-motorshome/scripts/train_trailer_model.py`
- `/home/edenilson/trailers-motorshome/scripts/render_aabb_views.py`
- `/home/edenilson/trailers-motorshome/src/services/SaveService.js`
- `/home/edenilson/trailers-motorshome/exports/Trailer-Nelcyr-Nardelli_rev25_organized.json`
- `/home/edenilson/trailers-motorshome/exports/Trailer-Nelcyr-Nardelli_rev33_all_gaps_applied.json`

## Observações De Qualidade

- Não declarar sucesso apenas com `Total: 0`.
- Não treinar com exemplo ruim sem rotular como negativo.
- Não colocar regra de engenharia no renderer JS.
- Não resolver envelope esticando o body.
- Preferir módulos canônicos determinísticos a coordenadas livres geradas por LLM.
- Auditoria e render visual precisam concordar.
