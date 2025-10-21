//assets

const blue_triangle = '/models/blue_triangle.svg';
const green_square = '/models/green_square.svg';
const orange_pentagon = '/models/orange_pentagon.svg';
const pink_cross = '/models/pink_cross.svg';
const purple_star = '/models/purple_star.svg';
const red_circle = '/models/red_circle.svg';
const teal_diamond = '/models/teal_diamond.svg';
const yellow_hexagon = '/models/yellow_hexagon.svg';

const newmessage_sound = '/sounds/plopp-84863.mp3';

export const models = {
    blue_triangle,
    green_square,
    orange_pentagon,
    pink_cross,
    purple_star,
    red_circle,
    teal_diamond,
    yellow_hexagon,
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
