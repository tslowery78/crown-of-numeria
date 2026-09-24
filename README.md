# Math Castle Quest (Meta Quest 3)

A WebXR castle game that runs in the Quest 3 browser, so there's nothing to install or sideload. There are six rooms (Entrance Hall, Great Hall, Royal Library, Knights' Armory, Crystal Tower, Throne Room). Every door has a magic lock that opens after the player solves math problems. Each room also has a treasure chest that opens with one more problem. Solving the final problems in the Throne Room wins the Royal Crown.

Problems are generated for **Bluebonnet Learning Grade 2 (Modules 1–8)** and **Grade 4 (Modules 1–7)**, following the modules in TEA's scope and sequence. On the setup screen you can also type in the actual homework problems, and those come first.

## Play it on the Quest (home Wi-Fi)

1. On the Mac, in this folder: `./serve.sh`. It prints an address like `https://192.168.4.222:8443`.
2. In the Quest browser, open that address. You'll see a certificate warning the first time. Tap **Advanced → Proceed**. This is expected because the certificate is self-made.
3. Choose the player's name and grade, tick the module(s) she's on, then tap **Enter the Castle in VR**.

The Quest and the Mac need to be on the same Wi-Fi network. WebXR only works over https, which is why the server uses https.

## Controls

| Action | Quest controllers | Hands (no controllers) | Desktop |
|---|---|---|---|
| Press a button | point + trigger | point + pinch | click |
| Open a chest | point at chest + trigger | pinch | click |
| Move | teleport (point at floor + trigger) or left stick | teleport | WASD / arrows |
| Turn | right stick (30° snaps) | turn your body | mouse |

A gem counter sits on the left controller. **Read** speaks the problem aloud and **Hint** gives a hint. Answering wrong gives "try again" the first time and a hint the second time. On the third miss the game shows the answer and serves a new problem, which doesn't count toward the lock.

## Adding homework

Type it on the setup screen or edit `homework.txt`. Put one problem on each line:

```
[grade 2]
245 + 367 = ? | 612
Is 17 even or odd? | odd | even; odd
[grade 4]
3/8 + 4/8 = ? | 7/8
```

Answers are checked by value, so `7/8`, `0.875`, `4.5` and `4.50` all match correctly. If an answer is a word, list the choices after a second `|`. Each name's settings and homework are saved on the headset per player. Tick "Only use my homework problems" to skip the generated practice.

## Files

- `index.html`: setup screen
- `js/game.js`: castle, VR input, puzzle panels
- `js/problems.js`: grade 2/4 problem generators, answer checking, homework parser
- `vendor/three/`: three.js r186, bundled so the game doesn't need a CDN
- `serve.sh`: local https server
- `screenshots/`: screenshots from the desktop test run
