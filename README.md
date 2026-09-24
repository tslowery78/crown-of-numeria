# Crown of Numeria (Meta Quest 3)

Crown of Numeria is a room-scale WebXR math tower that runs in the Quest 3 browser. Each floor of the castle tower is one room the size of your real play area, so the girls physically walk around it.

- **Floors:** there are six, in this order: Entrance Hall, Great Hall, Royal Library, Knights' Armory, Crystal Chamber, and the open-air Tower Top.
- **Magic Lock:** each floor has one on the north wall. Solving its problems dissolves the hatch in the ceiling. Standing on the glowing square in the middle of the room then lifts the player up to the next floor, so nobody has to walk outside the play area.
- **Treasure chests:** each floor has one in a corner. Touch it to get a bonus problem and a gem.
- **Tower Top:** the final lock opens the Crown of Numeria, and fireworks go off over the kingdom.

**Things to do on the way up:**

- **Heroes:** each girl picks a hero on the setup screen: a princess, knight, wizard, fairy or explorer, with her own outfit colour, hairstyle, hair colour and skin tone. Magic Mirrors on floors 1 and 4 and a Royal Mirror on the roof let her see herself. At the end the crown lands on her head.
- **Pick up and throw:** there's a bouncy ball, a rubber duck, a teddy bear, apples, a goblet, books, paper airplanes that glide, and a knight's helmet she can put on. Items thrown out of a window fall to the courtyard and then reappear back in the room.
- **Mini-games:**
  - toss apples into the basket in the Great Hall;
  - knight bowling in the Armory, which does the subtraction for her, e.g. "7 down! 10 − 7 = 3 standing";
  - pop bubbles from the cauldron and tap crystals that chime notes in the Crystal Chamber.
- **Creatures:** a sleepy cat that purrs and meows when petted, an owl that turns its head to follow her, a friendly dragon circling the tower past the windows, bird flocks, and a hot-air balloon.
- **Windows:** big arched windows look out on the kingdom: the courtyard and towers, a village with a windmill, a river and bridge, forests and mountains. The view gets higher on every floor.
- **Sound:** soft generated music changes mood on each floor, and short musical cues play for correct answers, unlocking, chests, the lift and the victory. Sound effects are positioned in 3D, with wind at the windows, torches crackling and birds outside. Music volume is set on the setup screen.

Problems are generated for **Bluebonnet Learning Grade 2 (Modules 1–8)** and **Grade 4 (Modules 1–7)**, following the modules in TEA's scope and sequence. On the setup screen you can also type in the actual homework problems, and those come first.

## Launch on the Quest

The game is hosted at **https://tslowery78.github.io/crown-of-numeria/**

Set it up once for each player: in the Quest browser, open that player's link and bookmark it (⋮ → Bookmark). Change the names below to the girls' names.

- `https://tslowery78.github.io/crown-of-numeria/?player=Ava&grade=2`
- `https://tslowery78.github.io/crown-of-numeria/?player=Lily&grade=4`

After that, she opens the Browser, taps her bookmark, and taps **Enter the Castle in VR**. Her progress, module choices and homework are saved on the headset under her name. Tap "change settings or add homework" to edit them.

To publish changes: `git commit` and `git push`, and GitHub Pages updates within about a minute.

### Offline or local option
Run `./serve.sh` on the Mac and open the https://<ip>:8443 address it prints. You'll need to accept a certificate warning once.

## Room setup

1. Clear the space and set a **room-scale** Guardian. A stationary boundary won't work because she needs to walk around.
2. Measure the clear square inside the Guardian and pick the next size down on the setup screen (2, 2.5, 3, 3.5 or 4 m). You can also add `&room=3` to a player's bookmark link.
3. She stands in the **middle** of the space and faces the wall that should hold the Magic Lock, then taps Enter. The virtual room is centred on that spot.

"Try automatic Guardian fit" reads the boundary through WebXR's `bounded-floor`. Other developers have reported that Quest 3 returns an empty or undersized boundary this way, so it's experimental. If no boundary comes back, the game falls back to 2.5 m.

## Controls

| Action | Hands | Controllers | Desktop |
|---|---|---|---|
| Press a button | poke it with your finger (or point + pinch) | poke it with the magic-wand tip (or point + trigger) | click |
| Open a chest | touch it | touch it with the wand, or point + trigger | click |
| Move | walk | walk | WASD / arrows + mouse |
| Go up a floor | stand on the glowing square | same | walk onto the square |
| Grab / throw | pinch near it, let go while moving | grip (or trigger) near it; point + trigger pulls it to your hand | click it, then click again to throw |

There's no thumbstick movement or turning, so the virtual walls always line up with the real room. The ride up takes about 5 seconds and pauses if she steps off the square. The gem and floor counter sits on the left controller.

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
- `js/game.js`: tower floors, windows and kingdom, mirrors, magic lift, touch/grab input, puzzle panels
- `js/props.js`: grab-and-throw physics, mini-games, creatures
- `js/avatar.js`: hero avatars and setup preview
- `js/audio.js`: procedural music, cues and 3D sound effects
- `js/problems.js`: grade 2/4 problem generators, answer checking, homework parser
- `vendor/three/`: three.js r186, bundled so the game doesn't need a CDN
- `serve.sh`: local https server
- `screenshots/`: screenshots from the desktop test run
