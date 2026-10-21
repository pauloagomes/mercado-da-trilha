# Cenário do tabuleiro

Três imagens com o mesmo enquadramento, trocadas por um fade de opacidade (`definirClima` em `public/js/app.js`):

| Arquivo | Quando aparece | Tamanho |
| --- | --- | --- |
| `public/img/cenario/dia.webp` | Rodadas normais (carrega com o tabuleiro) | 181 KB |
| `public/img/cenario/noite.webp` | Reta final, nas 3 últimas rodadas (C4) | 86 KB |
| `public/img/cenario/chuva.webp` | Rodada do evento Chuva, inclusive a chamada pelo Mestre do mercado | 165 KB |

Quem decide é `climaDaRodada` no `engine.js`: a chuva vence a noite, porque o evento dura só uma rodada e precisa ser notado. Noite e chuva só são baixadas quando forem usadas, ou 8 s depois de o tabuleiro abrir, se o aparelho não estiver em economia de dados.

As casas ficam 82% opacas e o centro quase transparente: o nome e o dado ficam em cima, o aviso embaixo, e a fogueira do cenário aparece no meio. Com "reduzir movimento" a troca é direta.

## Como as imagens foram feitas

Geradas em 21/10/2026 pelo Higgsfield, com 2048 × 2048 px, e convertidas para WebP com 1024 px e qualidade 64 (`magick ... -resize 1024x1024 -strip -quality 64 -define webp:method=6`).

1. **Dia:** texto para imagem com Z Image (o Soul Location, melhor para cenários, exige plano pago).
2. **Noite e Chuva:** edição da imagem do Dia com Seedream 5.0 Flash (`--image-references dia.png`), pedindo para manter cena, câmera e posição de tudo. É isso que garante as três imagens alinhadas: gerar cada uma do zero mudaria o lugar da clareira.

### Prompt do Dia

O prompt longo (abaixo, "base completa") falhou no Z Image sem motivo informado; a versão curta funcionou.

```text
Stylized 3D game art, near top-down view, square. A round campsite clearing of packed earth and gravel inside a dense Brazilian Atlantic Forest with several Araucaria angustifolia trees (candelabra-shaped crowns, flat tiers of branches), palms and giant tree ferns at the edges. A stone fire ring exactly in the center, fire out, only ash. Rustic log-and-rope fence around the clearing with unlit wooden torches. A dirt path leaves at the bottom-left corner. The middle of the image is calm, flat, low-contrast ground; all trees and detail stay near the edges. Sunny daytime, soft shadows, uniform sharpness. No people, no text, no logos, no UI.
```

### Prompt da Noite (edição do Dia)

```text
Edit this image. Keep the exact same scene, camera angle, framing and layout: same clearing, same fence, same trees in the same positions, same stone fire ring in the center, same dirt path at the bottom-left. Change only the time of day to night: dark night with deep blue shadows and moonlight on the foliage. The campfire in the center burns brightly and casts warm orange and yellow light on the earth, the fence and the nearby leaves. All the wooden torches along the fence are lit with small flames. Tiny glowing fireflies among the dark vegetation at the edges. Keep the middle of the clearing readable. No people, no text, no UI.
```

### Prompt da Chuva (edição do Dia)

```text
Edit this image. Keep the exact same scene, camera angle, framing and layout: same clearing, same fence, same trees in the same positions, same stone fire ring in the center, same dirt path at the bottom-left. Change only the weather: a heavy daytime rainstorm under a dark overcast sky, grey diffuse light. Visible rain streaks falling over the whole scene. The packed-earth ground is soaked, with small shiny reflective puddles and patches of dark mud. The campfire is out: wet stones and soggy grey ash, no flames, no smoke. All torches are unlit. The foliage looks heavy and wet. Light mist only at the forest edges; keep the middle of the clearing clear and readable. No people, no text, no UI.
```

### Base completa (para um modelo melhor, como o Soul Location)

```text
Stylized 3D game-art environment for a mobile board game, near top-down view (about 70 degree camera pitch, almost no perspective), square composition. A round campsite clearing of packed earth and fine gravel in the middle of a dense Brazilian Atlantic Forest. Several clearly visible Araucaria angustifolia trees (Parana pine) with candelabra-shaped crowns: horizontal tiers of upturned branches with dark green needle tufts only at the tips, flat-topped silhouettes. Also palms, giant tree ferns, tropical shrubs and native broad leaves. A ring of stones for a campfire sits exactly in the center of the frame, about 15 percent of the frame width. A rustic fence of wooden logs tied with rope surrounds the clearing, with wooden torches staked in the ground along it. A dirt-and-stone path leaves the clearing at the bottom-left corner and continues out of frame. Composition for a game board overlay: the central two thirds of the square is calm, evenly lit, low-contrast flat ground with only the stone ring; the trees, fence and torches stay in the outer band near the edges. Soft vignette at the edges, uniform sharpness, no depth-of-field blur. No people, no animals, no tents, no text, no letters, no logos, no user interface, no HUD, no watermark, no scout emblems, no generic pine or Christmas trees.
```

## Desvios desta versão

- **Sem araucárias.** O Z Image desenhou samambaias-gigantes e palmeiras; não conhece a copa em candelabro da araucária.
- **Fogueira e uma tocha acesas no Dia**, apesar do pedido. Na Chuva a fogueira e as tochas ficaram apagadas, e na Noite tudo aceso, como pedido.
- **Uma palmeira à direita invade a clareira**, ao lado da coluna de casas da direita.

Para corrigir, gere o Dia de novo com a "base completa" num modelo melhor (Soul Location ou GPT Image 2, que exigem plano ou créditos) e refaça Noite e Chuva por edição dele, com os mesmos prompts.
