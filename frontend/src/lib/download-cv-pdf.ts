import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Clone le nœud hors écran (sans transform parent / oklab hérités) puis capture pour éviter les erreurs
 * html2canvas + Safari (oklab) et les échelles d’aperçu.
 */
function cloneForCapture(source: HTMLElement): { wrapper: HTMLDivElement; clone: HTMLElement } {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-cv-pdf-capture", "1");
  wrapper.style.cssText =
    "position:fixed;left:-20000px;top:0;z-index:-1;background:#ffffff;overflow:visible;";
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.transform = "none";
  clone.style.margin = "0";
  clone.style.boxShadow = "none";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  return { wrapper, clone };
}

/**
 * PDF A4 une page : CV entier mis à l’échelle dans la zone utile (marges 15 mm).
 */
export async function downloadElementAsA4Pdf(
  element: HTMLElement,
  fileName: string
): Promise<void> {
  const { wrapper, clone } = cloneForCapture(element);

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      foreignObjectRendering: false,
      scrollX: 0,
      scrollY: 0,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginMm = 15;
    const innerW = pageWidth - 2 * marginMm;
    const innerH = pageHeight - 2 * marginMm;

    let drawW = innerW;
    let drawH = (canvas.height * drawW) / canvas.width;
    if (drawH > innerH) {
      drawH = innerH;
      drawW = (canvas.width * drawH) / canvas.height;
    }

    const x = marginMm + (innerW - drawW) / 2;
    const y = marginMm + (innerH - drawH) / 2;
    pdf.addImage(imgData, "JPEG", x, y, drawW, drawH);
    pdf.save(fileName);
  } finally {
    wrapper.remove();
  }
}
