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

Set it up once for each player: in the Quest browser, open that player's link and bookmark it (⋮ → Bookmark). Put the player's real name after `player=`:

- `…/crown-of-numeria/?player=NAME&grade=4&look=older` (big sister's look, 4th-grade maths)
- `…/crown-of-numeria/?player=NAME&grade=2&look=younger` (little sister's look, 2nd-grade maths)
- `look=mom` and `look=dad` work for grown-ups; add `&grade=2` or `&grade=4` for their maths.

After that, she opens the Browser, taps her bookmark, and taps **Enter the Castle in VR**. Her progress, module choices and homework are saved on the headset under her name. Tap "grown-up settings or homework" to edit them.

**Privacy:** this repository and site are public, so the family's names never go in the code. The four family looks are keyed by role (`older`, `younger`, `mom`, `dad`). Names are attached on the headset only, either through the bookmark's `look=` or under Grown-up settings → Family names. The character reference sheets in `design/` were made from family photos and are git-ignored.

## Setup screen

- **Who's playing?** has one card for each family member, other saved players, and "Someone else".
- **Choose your hero** shows a live preview. There are six hero classes (Adventurer, Princess, Knight, Wizard, Fairy, Explorer) and an outfit colour. A family member keeps her own face, hair, glasses and beard in every costume.
- **Grown-up settings** (collapsed) holds the name, the maths grade, hair and skin for custom players, family names, modules, homework, problems per lock, play area and music. Grade is separate from the look: choosing a family member's look never changes the grade, and grown-ups must pick one.

## Continue where you left off

The climb is saved on the headset after every finished problem, opened chest and floor. If the headset comes off or the page reloads, her bookmark offers **Continue the climb**, with her floor, open chests, gems and score. Homework problems she already finished aren't asked again, as long as the homework text hasn't changed. **Start a new tower** begins fresh. Finishing the tower clears the save.

## Homework report (for grown-ups)

Open **Grown-up settings → Homework report → Show report** for the last four climbs. For each problem it shows every answer she tried (wrong ones struck through), whether she got it on the first try, how long it took, and a thumbnail of her Magic Scroll working when she wrote any. **Practise the missed ones next time** copies anything she didn't get first time into the homework list. Reports stay on the headset only.

## Read-aloud

"Read each problem aloud automatically" (Grown-up settings) speaks each new problem as it appears. It is on by default for 2nd grade. The **Read** button on every panel still works either way.

## The Magic Scroll (scratch paper)

A parchment scroll hangs to the left of every Magic Lock so she can write out her steps, for example lining up 245 + 367 to add in columns. The top shows the current problem. She can write three ways:

- a fingertip touching the parchment (hand tracking);
- the magic-wand tip (controllers), or pointing and holding the trigger;
- holding the mouse button on desktop.

**Wipe** clears the page, and the three dots switch the ink between blue, red and green. Each new problem starts a fresh page. The scroll is only scratch paper: the answer still goes into the panel.

## Printing her work: answer-booklet inserts

When she finishes a problem, the working she wrote on the Magic Scroll is kept for printing. She can also press **Keep page** on the scroll part-way through. Her pen strokes are saved as lines rather than a picture (under 1 KB a page), so they print crisp at any size, cropped to the writing and on a white background.

To print, open **Grown-up settings → Answer-booklet inserts → Show her pages** and tick the pages you want. Choose **Small** (2½ × 2 in), **Medium** (3¼ × 2½ in) or **Large** (4 × 3 in), optionally **Black ink only**, and press **Print inserts**. Each insert has dashed cut lines, her name, the date, the problem, her working and her answer. Several fit on one sheet.

Pages are stored on the device she plays on. If that device can't print, **Save as picture** makes one image of the selected inserts at true size (200 dpi). It shares or downloads the image, depending on the device. Print it at 100% scale.

## Hands-on maths: the gem tray

Some problems come with a slanted gem tray beside the Magic Lock:

- Grade 2 facts within 20 use two ten-frames.
- Equal groups use one row per group.
- Grade 4 same-denominator fractions use one bar split into equal parts.

Blue gems are the starting amount. She adds or removes gems by pinching them, using the grip button, poking a slot with a finger, or pointing and pulling the trigger. The bowl underneath holds spare gems. The panel's answer follows the tray (for example "5/8"), and she presses OK. She can still type the answer on the keypad. On a third miss, the tray replays the operation one gem at a time before a new problem appears.

To publish changes: `git commit` and `git push`, and GitHub Pages updates within about a minute.

### Offline or local option
Run `./serve.sh` on the Mac and open the https://<ip>:8443 address it prints. You'll need to accept a certificate warning once.

## Room setup

1. Clear the space and set a **room-scale** Guardian. A stationary boundary won't work because she needs to walk around.
2. Measure the clear square inside the Guardian and pick the next size down on the setup screen (2, 2.5, 3, 3.5 or 4 m). You can also add `&room=3` to a player's bookmark link.
3. For a measured size, she stands in the **middle** of the space, faces the wall that should hold the Magic Lock, and taps Enter. Keep facing forward until the castle appears. The first tracked head pose sets the centre and direction.

"Try automatic Guardian fit" reads the boundary through WebXR's `bounded-floor` and uses its centre and direction. It is experimental: missing bounds or a fitted room smaller than 1.6 m on either side after margins stop entry and return to settings. Select a measured size instead. The game never enlarges an automatic fit to meet its minimum size.

**Recentering** (holding the Meta button) resets the tracking space. What happens next depends on the play-area setting:

- **Measured size:** the climb continues and the castle stays anchored to the same physical spot, using the reset transform the headset reports. If the headset reports none, a sign asks her to walk back to the middle, face the Magic Lock wall and pinch, and the room re-centres there.
- **Automatic Guardian fit:** the bounds may have changed, so VR ends and setup reopens.

## Controls

| Action | Hands | Controllers | Desktop |
|---|---|---|---|
| Press a button | poke it with your finger (or point + pinch) | poke it with the magic-wand tip (or point + trigger) | click |
| Open a chest | touch it | touch it with the wand, or point + trigger | click |
| Move | walk | walk | WASD / arrows + mouse |
| Go up a floor | stand on the glowing square | same | walk onto the square |
| Grab / throw | pinch near it, let go while moving | grip (or trigger) near it; point + trigger pulls it to your hand | click it, then click again to throw |

There's no thumbstick movement or turning. Check the room alignment against the clear space when entering VR. The ride up takes about 5 seconds and pauses if she steps off the square. The gem and floor counter sits on the left controller.

## Adding homework

Type it on the setup screen or edit `homework.txt`. Put one problem on each line:

```
[grade 2]
245 + 367 = ? | 612
Is 17 even or odd? | odd | even; odd
[grade 4]
3/8 + 4/8 = ? | 7/8
```

Answers are checked by value: `7/8` matches `0.875`, and `4.5` matches `4.50`. Mixed-number answers such as `1 1/2` are accepted and converted to an improper fraction; enter `3/2` or `1.5` in the game. Both grades' homework keypads include fractions, decimals, and a `±` sign key. Use backspace to correct input. If an answer is a word, list the choices after a second `|`. Each name's settings and homework are saved on the headset per player. Tick "Only use my homework problems" to skip the generated practice. Invalid homework blocks launch; homework-only requires at least one valid problem for the selected grade.

## Verification

`npm test` checks numeric parsing, homework-only behavior, and independently recomputes answers for 15,600 generated questions across 78 generators.

For browser regressions, install dependencies with `npm ci`, start `python3 -m http.server 8765 --bind 127.0.0.1`, then run `npm run test:browser` with Chrome installed. To check the published game, run `npm run test:browser -- https://tslowery78.github.io/crown-of-numeria/`. These tests use isolated browser storage, accelerated gameplay, and stub XR sessions for boundary and coordinate tests.

Desktop and simulated XR tests do not establish Quest frame rate, stereo mirror quality, hand/controller throw feel, or perceived spatial sound. Mirrors add substantial draw calls; reduced mirror resolution only reduces pixel work. The hidden setup preview is stopped and disposed before gameplay.

## Files

- `index.html`: setup screen
- `js/game.js`: tower floors, windows and kingdom, mirrors, magic lift, touch/grab input, puzzle panels
- `js/props.js`: grab-and-throw physics, mini-games, creatures
- `js/avatar.js`: family looks, hero avatars and setup preview
- `js/tray.js`: the hands-on gem tray
- `js/scroll.js`: the Magic Scroll scratch paper
- `assets/title.jpg`: setup-page illustration
- `tests/`: `npm test` covers answer checking and 15,600 generated problems. `npm run test:browser:files` runs the full desktop and simulated-VR regression in Chrome, serving files from disk.
- `js/audio.js`: procedural music, cues and 3D sound effects
- `js/problems.js`: grade 2/4 problem generators, answer checking, homework parser
- `vendor/three/`: three.js r186, bundled so the game doesn't need a CDN
- `serve.sh`: local https server
- `screenshots/`: screenshots from the desktop test run
