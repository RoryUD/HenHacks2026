const container = document.getElementById("blocksContainer");
const blockCountSelect = document.getElementById("blockCount");

// Generate blocks function
function generateBlocks() {
  container.innerHTML = "";
  const count = parseInt(blockCountSelect.value, 10);

  for (let i = 0; i < count; i++) {
    const blockDiv = document.createElement("div");
    blockDiv.classList.add("block");

    blockDiv.innerHTML = `
      <h4>Block ${i + 1}</h4>
      Text: <input class="text"><br>
      Top Left X: <input type="number" class="x1"><br>
      Top Left Y: <input type="number" class="y1"><br>
      Bottom Right X: <input type="number" class="x2"><br>
      Bottom Right Y: <input type="number" class="y2"><br>
      <hr>
    `;

    container.appendChild(blockDiv);
  }
}

// Generate on dropdown change
blockCountSelect.addEventListener("change", generateBlocks);

// Generate initial block on load
generateBlocks();

document.getElementById("create").addEventListener("click", async () => {
  const width = parseInt(document.getElementById("width").value, 10);
  const height = parseInt(document.getElementById("height").value, 10);

  const blocks = [];
  const blockDivs = document.querySelectorAll(".block");

  for (let blockDiv of blockDivs) {
    const text = blockDiv.querySelector(".text").value.trim();
    const x1 = parseInt(blockDiv.querySelector(".x1").value, 10);
    const y1 = parseInt(blockDiv.querySelector(".y1").value, 10);
    const x2 = parseInt(blockDiv.querySelector(".x2").value, 10);
    const y2 = parseInt(blockDiv.querySelector(".y2").value, 10);

    if (!text || isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2) || x1 >= x2 || y1 >= y2) {
      alert("Invalid block input.");
      return;
    }

    blocks.push({ text, x1, y1, x2, y2 });
  }

  await browser.runtime.sendMessage({
    width,
    height,
    blocks
  });

  window.close();
});

// Enlarge images by downloading and put on separate document!
document.getElementById("dw-pages").addEventListener("click", async () => {
  const numPages = parseInt(document.getElementById("pages").value, 10);
  try {
        // Find the current active tab in the current window
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        if (!activeTab) return;

        // Send the message to download.js
        console.log("Sending message to content script...");
        const response = await browser.tabs.sendMessage(activeTab.id, { 
            action: "START_DOWNLOAD",
            limit: numPages
        });

        console.log("Content script responded:", response);
    } catch (error) {
        // This is where the "Uncaught (in promise)" usually comes from
        console.error("Could not communicate with the page. Is it a Shonen Jump page?", error);
        alert("Error: Make sure you are on the manga reader page and refresh it.");
    }
});
