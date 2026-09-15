const { EmbedBuilder } = require('discord.js');
const { getAccount, addCash } = require('../../utils/economyManager');

const SYMBOLS = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];
// Multipliers for three-of-a-kind, keyed by symbol
const MULTIPLIERS = { '🍒': 2, '🍋': 3, '🍇': 4, '🔔': 6, '💎': 10, '7️⃣': 20 };

function spin() {
    return [0, 0, 0].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
}

module.exports = {
    name: 'slots',
    description: 'Bet coins on the slot machine (virtual currency only)',
    async execute(client, message, args) {
        const amount = parseInt(args[0], 10);
        if (!amount || amount <= 0) return message.reply('Usage: `.slots <amount>`');

        const acc = await getAccount(message.author.id, message.guild.id);
        if (acc.cash < amount) return message.reply("You don't have enough cash for that bet.");

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

        await addCash(message.author.id, message.guild.id, winnings);

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
