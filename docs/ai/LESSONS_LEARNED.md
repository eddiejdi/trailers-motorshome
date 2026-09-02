# Lessons Learned

## 2026-08-31 - Envelope do mezanino
- Erro: paredes do mezanino foram criadas como placas separadas e invadiram areas erradas.
- Causa: mistura de referencias locais/globais e tentativa de corrigir visual criando paredes extras.
- Correcao: manter cacamba e mezanino dentro do mesmo envelope (`wallsExt`) e controlar altura por `mzWallY0`.
- Regra: quando uma parede parecer ausente, primeiro verificar referencia, grupo pai e visibilidade antes de criar nova geometria.

## 2026-08-31 - Crash de renderizacao
- Erro: `Body.build()` retornou `frontMzGroup` depois que a variavel foi removida.
- Sintoma: pagina exibia erro e nao renderizava o projeto.
- Correcao: remover referencias a variaveis inexistentes e validar no browser.
- Regra: toda remocao estrutural deve revisar retorno de factory/build e usuarios desse retorno.

## 2026-08-31 - Walkthrough estatico
- Erro: modo entrar ativava HUD/maos, mas movimento ficava imperceptivel/travado.
- Causa: foco/eventos de teclado e colisao excessiva com objetos soltos.
- Correcao: focar canvas ao entrar, capturar keydown em fase capture, aceitar setas e liberar colisao com moveis soltos.
- Regra: testar walkthrough medindo camera antes/depois de tecla, nao apenas verificando HUD.

## 2026-08-31 - Cache e deploy
- Erro: algumas correcoes foram validadas localmente mas usuario via versao antiga em producao.
- Correcao: atualizar query string do modulo principal e validar `mainSrc` no browser.
- Regra: depois de deploy, validar URL final e conferir que `script[type=module]` carrega a versao esperada.
