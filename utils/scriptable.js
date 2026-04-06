// --- CONFIGURATION ---
// Replace with your computer's local IP address
const url = "http://monodesktop.taild6ff53.ts.net:13371/today-tasks"; 

let widget = new ListWidget();
widget.backgroundColor = new Color("#1e1e1e");

try {
  let req = new Request(url);
  let json = await req.loadJSON();
  let tasks = Object.values(json.tasks);

  // Header
  let title = widget.addText("📅 Today's Tasks");
  title.textColor = Color.white();
  title.font = Font.boldSystemFont(14);
  widget.addSpacer(8);

  if (tasks.length === 0) {
    widget.addText("All caught up! 🎉").textColor = Color.gray();
  } else {
    // Show up to 10 tasks (so they fit in a small widget)
    for (let i = 0; i < Math.min(tasks.length, 10); i++) {
      let item = widget.addText("• " + tasks[i].task.replace("- [ ] #todo", "").trim());
      item.textColor = Color.white();
      item.font = Font.systemFont(12);
      item.lineLimit = 2;
    }

    if (tasks.length > 10) {
      widget.addSpacer(4);
      let more = widget.addText(`+ ${tasks.length - 10} more...`);
      more.textColor = Color.gray();
      more.font = Font.italicSystemFont(10);
    }
  }
} catch (e) {
  widget.addText("Offline ❌").textColor = Color.red();
  widget.addText("Check if PC is on").font = Font.systemFont(10);
}

Script.setWidget(widget);
Script.complete();
widget.presentSmall();
