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
| `tgvoice log 50` | ເບິ່ງ 50 ລາຍການລ່າສຸດ |

## ພຶດຕິກຳ

- **ຮັບສະເພາະເຈົ້າ.** ຄົນອື່ນທີ່ເຈິ bot ຈະຖືກບໍ່ສົນໃຈ.
- **ລອງໃໝ່ເທື່ອດຽວ.** ຖ້າ Gemini ຜິດພາດ ມັນລອງອີກເທື່ອດຽວ ແລ້ວແຈ້ງສາເຫດໃນ Telegram.
- **ຂ້າມສຽງເກົ່າ.** ສຽງທີ່ສົ່ງມາກ່ອນເກີນ 1 ນາທີ (ຕອນຄອມຫຼັບ ຫຼື `tgvoice` ປິດຢູ່) ຈະບໍ່ຖືກ paste.
- **ໜຶ່ງ bot ຕໍ່ໜຶ່ງຄອມ.** ຢາກໃຊ້ສອງຄອມ ໃຫ້ສ້າງສອງ bot. ເລືອກ bot ກໍຄືເລືອກຄອມ.

## ໄຟລ໌

- `~/.tgvoice/config.json`: API key, bot token ແລະ ຜູ້ທີ່ຈັບຄູ່ (ອ່ານໄດ້ສະເພາະເຈົ້າ)
- `~/.tgvoice/history.jsonl`: ປະຫວັດ 1,000 ລາຍການລ່າສຸດ

ປ່ຽນ model ໄດ້ໂດຍແກ້ `"model"` ໃນ `config.json` (ຄ່າເລີ່ມຕົ້ນ `gemini-2.5-flash`).

## ຖອນການຕິດຕັ້ງ

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
