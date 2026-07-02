//assets

import blue_triangle from './models/client/blue_triangle.svg';
import green_square from './models/client/green_square.svg';
import orange_pentagon from './models/client/orange_pentagon.svg';
import pink_cross from './models/client/pink_cross.svg';
import purple_star from './models/client/purple_star.svg';
import red_circle from './models/client/red_circle.svg';
import teal_diamond from './models/client/teal_diamond.svg';
import yellow_hexagon from './models/client/yellow_hexagon.svg';

import newmessage_sound from './sounds/plopp-84863.mp3';

export const models = {
  blue: blue_triangle,
  green: green_square,
  orange: orange_pentagon,
  pink: pink_cross,
  purple: purple_star,
  red: red_circle,
  teal: teal_diamond,
  yellow: yellow_hexagon,
};

export const sounds = {
    newmessage_sound,
};

export const assets = {
    ...models,
    ...sounds,
    // Add more assets as needed
    // Example: images, sounds, etc.
};
