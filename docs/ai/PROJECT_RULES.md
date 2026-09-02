# Trailer 3D Project Rules

## Coordinate System
- Z negativo = frente/cambao.
- Z positivo = traseira.
- X negativo = lado esquerdo.
- X positivo = lado direito.
- Y = altura.

## Floor Reference
- `FLOOR_Y` e a base comum do interior, paredes e teto.
- Envelope visual deve alinhar com `FLOOR_Y`.
- Nao criar geometrias estruturais com offsets locais sem validar o world position.

## Envelope And Roof
- Paredes externas da cacamba e do mezanino devem fazer parte de um envelope unico (`wallsExt`).
- O teto deve acompanhar o mesmo referencial vertical das paredes.
- Nao criar placas soltas no cambao de engate.
- Nao adicionar paredes extras sem validar visualmente em browser.

## Mezzanine Walls
- Laterais/frente do mezanino: somente metade superior, com base em `mzWallY0`.
- Parede aos pes da cama do mezanino: somente metade inferior, limitada ate `mzWallY0`.
- A janela do mezanino nao pode ficar flutuando; deve estar associada ao envelope correto.

## Walkthrough
- Modo entrar deve focar o canvas e capturar teclado.
- `WASD` e setas devem mover a camera.
- Mouse/pointer lock deve controlar a direcao da camera.
- Maos virtuais aparecem no centro da mira/mouse, logo abaixo do centro da tela.

## Validation
- Antes de deploy: `node --check` nos arquivos JS alterados.
- Para mudancas visuais: validar com browser headless e screenshot.
- Confirmar console sem erro fatal antes de publicar.
