const { EmbedBuilder } = require('discord.js');
const Schema = require('../../database/models/economy');

const SYMBOLS = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];
// Multipliers for three-of-a-kind, keyed by symbol
const MULTIPLIERS = { '🍒': 2, '🍋': 3, '🍇': 4, '🔔': 6, '💎': 10, '7️⃣': 20 };

function spin() {
    return [0, 0, 0].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
}

async function getBalance(userId) {
    const data = await Schema.findOne({ User: userId }).lean().exec();
    return data?.Money ?? 0;
}

async function changeBalance(userId, amount) {
    return Schema.findOneAndUpdate(
        { User: userId },
        { $inc: { Money: amount }, $setOnInsert: { Bank: 0 } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
}

module.exports = {
    name: 'slots',
    description: 'Bet coins on the slot machine (virtual currency only)',
    async execute(client, message, args) {
        const amount = parseInt(args[0], 10);
        if (!amount || amount <= 0) return message.reply('Usage: `.slots <amount>`');

        const balance = await getBalance(message.author.id);
        if (balance < amount) return message.reply("You don't have enough cash for that bet.");

        const [a, b, c] = spin();
        let winnings = 0;
        let resultText;

        if (a === b && b === c) {
            winnings = amount * MULTIPLIERS[a];
            resultText = `🎉 JACKPOT! Three ${a} in a row!`;
        } else if (a === b || b === c || a === c) {
            winnings = Math.floor(amount * 1.5);
            resultText = '✨ Two matching symbols — small win!';
        } else {
            winnings = -amount;
            resultText = 'No match — better luck next time.';
        }

        await changeBalance(message.author.id, winnings);

        const embed = new EmbedBuilder()
            .setColor(winnings > 0 ? '#57F287' : '#ED4245')
            .setTitle('🎰 Slot Machine')
            .setDescription(
                `**[ ${a} | ${b} | ${c} ]**\n\n${resultText}\n` +
                (winnings > 0
                    ? `You won **${winnings.toLocaleString()}** coins!`
                    : `You lost **${amount.toLocaleString()}** coins.`)
            );

        message.reply({ embeds: [embed] });
    }
};
