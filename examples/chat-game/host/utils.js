


let colors = ["red", "blue", "green", "yellow", "purple", "orange"];
let usedColors = new Set();

function getRandomColor() {
    let availableColors = colors.filter((color) => !usedColors.has(color));
    if (availableColors.length === 0) {
        return "red"; // Default color if all colors are used
    }
    let color = availableColors[Math.floor(Math.random() * availableColors.length)];
    usedColors.add(color);
    return color;
}

function getUserList(world,PeerBox) {
    return world.getEntitiesWithComponent(PeerBox.Components.userComponent).map((e) => {
            const comp = world.getComponent(e, PeerBox.Components.userComponent);
            return { id: comp.id, name: comp.name, color: comp.color, connected: comp.connected};
        }
    ).filter(user => user.connected);
}

module.exports = {
    getUserList,
    getRandomColor
};