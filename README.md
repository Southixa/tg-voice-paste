# tg-voice-paste

ອັດສຽງໃນ Telegram ແລ້ວສົ່ງເຂົ້າ bot. ຄອມທີ່ແລ່ນ `tgvoice` ຢູ່ຈະແປງສຽງເປັນຂໍ້ຄວາມດ້ວຍ Gemini ແລະ paste ໃສ່ບ່ອນທີ່ cursor ຢູ່ທັນທີ.

ເໝາະກັບຄອມທີ່ບໍ່ມີໄມ: ໃຊ້ມືຖືເປັນໄມແທນ.

```
ມືຖື: ອັດສຽງໃນ bot
   ▼
ຄອມ: tgvoice ດາວໂຫຼດສຽງ → Gemini → paste ໃສ່ບ່ອນ cursor
   ▼
ມືຖື: bot ຕອບກັບດ້ວຍຂໍ້ຄວາມທີ່ paste ຫຼືສາເຫດທີ່ບໍ່ໄດ້
```

## ສິ່ງທີ່ຕ້ອງມີ

- macOS
- Node.js 18 ຂຶ້ນໄປ (`node -v`)
- Gemini API key ຈາກ https://aistudio.google.com/apikey
- Telegram bot ໜຶ່ງໂຕຕໍ່ໜຶ່ງຄອມ (ສ້າງໃນ [@BotFather](https://t.me/BotFather) ດ້ວຍ `/newbot`)

## ຕິດຕັ້ງ

```bash
npm install -g https://github.com/Southixa/tg-voice-paste/tarball/main
```

```bash
tgvoice
```

ເທື່ອທຳອິດ `tgvoice` ຈະຖາມ 4 ຂັ້ນຕອນ ແລ້ວເລີ່ມຮັບສຽງເລີຍ:

1. Gemini API key
2. Bot token ຈາກ BotFather
3. ຈັບຄູ່: ເປີດ bot ໃນ Telegram ແລ້ວກົດ Start, ຈາກນັ້ນຢືນຢັນໃນ Terminal ວ່າແມ່ນເຈົ້າ
4. ທົດສອບ paste

## ຕິດຕັ້ງດ້ວຍຄຳສັ່ງດຽວ

ກຽມຄຳສັ່ງໄວ້ລ່ວງໜ້າ ແລ້ວ paste ໃສ່ Terminal ຂອງຄອມໃໝ່. ມັນຈະຕິດຕັ້ງ, ຕັ້ງຄ່າ ແລະ ເລີ່ມຮັບສຽງ. ເຫຼືອແຕ່ເປີດສິດ Accessibility ຕອນມັນທົດສອບ paste.

```bash
npm install -g https://github.com/Southixa/tg-voice-paste/tarball/main && \
tgvoice setup \
  --gemini-key 'GEMINI_KEY' \
  --bot-token 'BOT_TOKEN' \
  --owner TELEGRAM_ID \
  --language lo \
  --startup off && \
tgvoice
```

`--language` ແລະ `--startup` ບໍ່ໃສ່ກໍໄດ້; ຄ່າເລີ່ມຕົ້ນຄື `lo` ແລະ `off`.

ໃນຄອມທີ່ຕັ້ງຄ່າແລ້ວ ຄຳສັ່ງນີ້ຈະພິມຄຳສັ່ງຂ້າງເທິງອອກມາ ພ້ອມ Gemini key ແລະ Telegram ID ຂອງເຈົ້າ. ເຫຼືອແຕ່ໃສ່ token ຂອງ bot ໃໝ່:

```bash
tgvoice template
```

`--owner` ແມ່ນເລກ Telegram ID ຂອງເຈົ້າ. ໃສ່ແລ້ວ ຈະບໍ່ຕ້ອງຢືນຢັນການຈັບຄູ່ໃນ Terminal, ແຕ່ຍັງຕ້ອງກົດ Start ໃນ bot ໃໝ່ເທື່ອໜຶ່ງ ເພື່ອໃຫ້ມັນຕອບກັບໄດ້.

ຄຳສັ່ງທີ່ມີ key ແລະ token ຈະຄ້າງຢູ່ໃນປະຫວັດ shell ຂອງຄອມນັ້ນ (`~/.zsh_history`).

## ສິດທີ່ຕ້ອງເປີດ (ເທື່ອດຽວຕໍ່ຄອມ)

ການກົດ Cmd+V ແທນເຈົ້າຕ້ອງໃຊ້ສິດ **Accessibility** ຂອງແອັບ Terminal ທີ່ແລ່ນ `tgvoice`:

System Settings > Privacy & Security > Accessibility > ເປີດ **Terminal**

ຂັ້ນຕອນທີ 4 ຈະເປີດໜ້ານີ້ໃຫ້ເອງຖ້າຍັງບໍ່ມີສິດ. ຖ້າບໍ່ເປີດ ຂໍ້ຄວາມຈະຍັງຖືກ copy ໃສ່ clipboard ໃຫ້ກົດ Cmd+V ເອງ.

## ການໃຊ້

ເປີດ Terminal ຄ້າງໄວ້ໃຫ້ `tgvoice` ແລ່ນຢູ່, ວາງ cursor ໃສ່ບ່ອນທີ່ຢາກພິມ, ແລ້ວສົ່ງ voice message ເຂົ້າ bot.

| ໃນ Telegram | ຜົນ |
|---|---|
| voice message | ແປງ ແລະ paste |
| `/lo` | ໂໝດພາສາລາວ (ຄ່າເລີ່ມຕົ້ນ) |
| `/en` | ໂໝດແປເປັນອັງກິດ |
| `/log` | 10 ລາຍການລ່າສຸດ: ອັນໃດໄດ້ ອັນໃດບໍ່ໄດ້ ຍ້ອນຫຍັງ |

| ໃນ Terminal | ຜົນ |
|---|---|
| `tgvoice` | ເລີ່ມຮັບສຽງ |
| `tgvoice setup` | ຕັ້ງຄ່າໃໝ່ |
| `tgvoice config` | ເບິ່ງ ຫຼື ປ່ຽນພາສາ ແລະ startup |
| `tgvoice log 50` | ເບິ່ງ 50 ລາຍການລ່າສຸດ |

## ການຕັ້ງຄ່າ

```bash
tgvoice config
```

| ຄຳສັ່ງ | ຜົນ |
|---|---|
| `tgvoice config --language lo` | ຂໍ້ຄວາມເປັນພາສາລາວ (ຄ່າເລີ່ມຕົ້ນ) |
| `tgvoice config --language en` | ແປເປັນອັງກິດ |
| `tgvoice config --startup off` | ຕ້ອງພິມ `tgvoice` ເອງເພື່ອເລີ່ມ (ຄ່າເລີ່ມຕົ້ນ) |
| `tgvoice config --startup on` | ເປີດເອງທຸກເທື່ອທີ່ login |

ໃສ່ທັງສອງໃນຄຳສັ່ງດຽວກໍໄດ້: `tgvoice config --language en --startup on`.

ເມື່ອ startup ເປັນ `on` ໜ້າຕ່າງ Terminal ຈະເປີດຂຶ້ນຕອນ login ແລະ ແລ່ນ `tgvoice` ຢູ່ໃນນັ້ນ. ມັນແລ່ນໃນ Terminal ເພື່ອໃຊ້ສິດ Accessibility ທີ່ເປີດໃຫ້ Terminal ໄວ້ແລ້ວ, ບໍ່ຕ້ອງເປີດສິດເພີ່ມ. ຍໍ່ໜ້າຕ່າງລົງໄດ້ ແຕ່ຖ້າປິດ ມັນຈະຢຸດ.

ການປ່ຽນພາສາມີຜົນຕອນເປີດ `tgvoice` ຮອບໜ້າ. ຢາກປ່ຽນທັນທີ ໃຫ້ພິມ `/en` ຫຼື `/lo` ໃນ bot.

## ພຶດຕິກຳ

- **ຮັບສະເພາະເຈົ້າ.** ຄົນອື່ນທີ່ເຈິ bot ຈະຖືກບໍ່ສົນໃຈ.
- **ລອງໃໝ່ເທື່ອດຽວ.** ຖ້າ Gemini ຜິດພາດ ມັນລອງອີກເທື່ອດຽວ ແລ້ວແຈ້ງສາເຫດໃນ Telegram.
- **ຂ້າມສຽງເກົ່າ.** ສຽງທີ່ສົ່ງມາກ່ອນເກີນ 1 ນາທີ (ຕອນຄອມຫຼັບ ຫຼື `tgvoice` ປິດຢູ່) ຈະບໍ່ຖືກ paste.
- **ໜຶ່ງ bot ຕໍ່ໜຶ່ງຄອມ.** ຢາກໃຊ້ສອງຄອມ ໃຫ້ສ້າງສອງ bot. ເລືອກ bot ກໍຄືເລືອກຄອມ.

## ໄຟລ໌

- `~/.tgvoice/config.json`: API key, bot token ແລະ ຜູ້ທີ່ຈັບຄູ່ (ອ່ານໄດ້ສະເພາະເຈົ້າ)
- `~/.tgvoice/history.jsonl`: ປະຫວັດ 1,000 ລາຍການລ່າສຸດ
- `~/.tgvoice/tgvoice.command` ແລະ `~/Library/LaunchAgents/com.tgvoice.startup.plist`: ມີສະເພາະຕອນ startup ເປັນ `on`

ປ່ຽນ model ໄດ້ໂດຍແກ້ `"model"` ໃນ `config.json` (ຄ່າເລີ່ມຕົ້ນ `gemini-2.5-flash`).

## ຖອນການຕິດຕັ້ງ

```bash
tgvoice config --startup off
```

```bash
npm uninstall -g tg-voice-paste
```

```bash
rm -r ~/.tgvoice
```

## ພັດທະນາ

```bash
npm test
```
