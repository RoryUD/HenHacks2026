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