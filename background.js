// background.js
// Content Script cannot fetch HTTP resources from HTTPS pages directly due to Mixed Content restrictions.
// So we use this Background Script to handle the network request.

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "uploadImage") {
        uploadToPythonServer(message.imageSrc, message.filename)
            .then(data => sendResponse({ success: true, data: data }))
            .catch(error => sendResponse({ success: false, error: error.toString() }));
        
        return true; // Indicates we will respond asynchronously
    }
});

async function uploadToPythonServer(imageSrc, filename) {
    const API_URL = "http://127.0.0.1:5001/process";

    try {
        // Let's expect a Data URL string from the content script.
        const res = await fetch(imageSrc);
        const blob = await res.blob();
        
        const formData = new FormData();
        formData.append("image", blob, filename);

        const response = await fetch(API_URL, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error(`[background]Server Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("[background]Background fetch error:", error);
        throw error;
    }
}
