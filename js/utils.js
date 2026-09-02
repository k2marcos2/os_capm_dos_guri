export const Utils = {
  id(prefix = "id") {
    if (window.crypto?.randomUUID) {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  },

  clean(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  },

  shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }
    return copy;
  },

  winsNeeded(bestOf) {
    return Math.ceil(Number(bestOf) / 2);
  },

  highestPowerOfTwo(value) {
    return 2 ** Math.floor(Math.log2(value));
  },

  formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
      }).format(new Date(iso));
    } catch {
      return "—";
    }
  },

  toast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(Utils.toastTimer);
    Utils.toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }
};
