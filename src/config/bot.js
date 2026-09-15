module.exports = {
    colors: {
        // `succes` is kept for backwards compatibility with older modules.
        success: '#57F287',
        succes: '#57F287',
        error: '#ED4245',
        warning: '#FEE75C',
        normal: '#5865F2',
    },

    discord: {
        id: process.env.DISCORD_ID,
        prefix: '.',
        footer: `© LightCore ${new Date().getFullYear()}`,
        botInvite: `https://discord.com/oauth2/authorize?client_id=1516313619476779120&permissions=8&scope=bot%20applications.commands`,
        serverInvite: 'https://discord.gg/Ehmqr5drSz',
    },

    // Public-release defaults. Environment variables can override deployment-specific values.
    limits: {
        maxPrefixLength: 5,
        maxTicketCategories: 25,
        maxCustomCommandLength: 2000,
        commandTimeoutMs: 15000,
        interactionTimeoutMs: 2500,
    },

    wordList: `Airplane
Ears
Piano
Angry
Elephant
Pinch
Baby
Fish
Reach
Ball
Flower
Round
Banana
Foot
Scissors
Beach
Grass
Snow
Bird
Hat
Socks
Book
House
Spoon
Bottle
Key
Star
Cat
Lion
Tree
Chair
Moon
Umbrella
Cloud
Ocean
Computer
Pizza
Dragon
Rocket
Eagle
Guitar
Fire
Castle
Robot
Rainbow
Camera
Mountain
Cookie
Diamond
Ghost
Heart
Ice
Jacket
Kite
Lamp
Mirror
Orange
Pencil
Queen
River
Shark
Train
Volcano
Watch
Zebra`,
};
