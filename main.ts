import { Plugin, Editor, TFile } from "obsidian";

const IMAGE_STORAGE_PATH = "images";
const IMAGE_JSON_PATH = `${IMAGE_STORAGE_PATH}/images.json`;

export default class Image64 extends Plugin {
  async onload() {
    this.ensureJsonFileExists();

    this.registerEvent(
      this.app.workspace.on("editor-paste", async (evt: ClipboardEvent, editor: Editor) => {
        if (!evt.clipboardData) return;
        const items: DataTransferItemList = evt.clipboardData.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
          const item: DataTransferItem = items[i];
          if (item.type.startsWith("image/")) {
            evt.preventDefault();
            await this.processImage(item, editor);
          }
        }
      })
    );

    // 📌 JSON 데이터를 이용하여 HTML 태그를 렌더링하는 기능 추가
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      const placeholders: NodeListOf<HTMLSpanElement> = el.querySelectorAll("span.base64-image-placeholder");
      for (const placeholder of Array.from(placeholders)) {
        const imageKey = placeholder.getAttribute("data-image-key");
        if (imageKey) {
          const base64Image = await this.getBase64FromJson(imageKey);
          if (base64Image) {
            const imgElement = document.createElement("img");
            imgElement.src = base64Image;
            imgElement.style.maxWidth = "100%";
            placeholder.replaceWith(imgElement);
          } else {
          }
        }
      }
    });
  }

  async ensureJsonFileExists(): Promise<void> {
    const vault = this.app.vault;

    if (!vault.getAbstractFileByPath(IMAGE_STORAGE_PATH)) {
      await vault.createFolder(IMAGE_STORAGE_PATH);
    }

    const file = vault.getAbstractFileByPath(IMAGE_JSON_PATH);
    if (!(file instanceof TFile)) {
      await vault.adapter.write(IMAGE_JSON_PATH, JSON.stringify({}, null, 2));
    }
  }

  async processImage(item: DataTransferItem, editor: Editor): Promise<void> {
    const file: File | null = item.getAsFile();
    if (!file) {
      return;
    }

    const reader: FileReader = new FileReader();
    reader.onload = async () => {
      const base64Data: string = reader.result as string;
      const imageKey: string = `image_${Date.now()}`;

      await this.saveImageToJson(imageKey, base64Data);
      
      // JSON에서 불러올 수 있도록 `span` 태그 삽입
      const placeholder = `<span class="base64-image-placeholder" data-image-key="${imageKey}">📌 로드 중...</span>`;
      editor.replaceSelection(placeholder);
    };
    reader.readAsDataURL(file);
  }

  async saveImageToJson(imageKey: string, base64Data: string): Promise<void> {
    const vault = this.app.vault;

    let jsonData: Record<string, string> = {};
    const file = vault.getAbstractFileByPath(IMAGE_JSON_PATH);

    if (file instanceof TFile) {
      try {
        const content: string = await vault.read(file);
        jsonData = JSON.parse(content);
      } catch (e) {
        jsonData = {};
      }
    }

    jsonData[imageKey] = base64Data;

    await vault.adapter.write(IMAGE_JSON_PATH, JSON.stringify(jsonData, null, 2));
  }

  async getBase64FromJson(imageKey: string): Promise<string | null> {
    const vault = this.app.vault;

    const file = vault.getAbstractFileByPath(IMAGE_JSON_PATH);
    if (file instanceof TFile) {
      try {
        const content: string = await vault.read(file);
        const jsonData: Record<string, string> = JSON.parse(content);
        return jsonData[imageKey] || null;
      } catch (e) {
      }
    }
    return null;
  }
}