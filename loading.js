/* ==========================================================================
   NEXUS KNIGHT ANIME - Global Loading Screen Controller (loading.js)
   Developer: Keelz Valentine
   ========================================================================== */

(function () {
  let progressState = 0;
  let progressInterval = null;
  let isPageLoaded = false;

  /**
   * Mengambil referensi elemen loading screen dari DOM
   */
  function getLoadingElements() {
    return {
      screen: document.getElementById("loadingScreen"),
      progress: document.getElementById("loadingProgress")
    };
  }

  /**
   * Memperbarui UI persentase loading
   */
  function updateProgressUI(val) {
    const { progress } = getLoadingElements();
    if (progress) {
      const currentVal = Math.min(100, Math.max(0, Math.floor(val)));
      progress.textContent = `${currentVal}%`;
    }
  }

  /**
   * Hentikan interval untuk mencegah memory leak
   */
  function stopInterval() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }

  /**
   * Menjalankan animasi simulasi progress hingga 85%
   */
  function startSimulatedProgress() {
    stopInterval();
    progressState = 10;
    updateProgressUI(progressState);

    progressInterval = setInterval(() => {
      if (progressState < 85) {
        progressState += Math.floor(Math.random() * 12) + 5;
        if (progressState > 85) progressState = 85;
        updateProgressUI(progressState);
      } else {
        stopInterval();
      }
    }, 100);
  }

  /**
   * Tampilkan loading screen secara global
   */
  window.showPageLoader = function () {
    const { screen } = getLoadingElements();
    if (!screen) return;

    screen.style.display = "flex";
    screen.classList.remove("hidden");
    startSimulatedProgress();
  };

  /**
   * Sembunyikan loading screen secara global
   */
  window.hidePageLoader = function () {
    stopInterval();
    const { screen } = getLoadingElements();
    if (!screen) return;

    screen.style.display = "none";
    screen.classList.add("hidden");
  };

  /**
   * Selesaikan loading hingga 100% lalu sembunyikan screen
   */
  function completeLoading() {
    stopInterval();
    updateProgressUI(100);

    setTimeout(() => {
      window.hidePageLoader();
    }, 150);
  }

  /**
   * Inisialisasi otomatis saat halaman dimuat
   */
  function initLoader() {
    const { screen } = getLoadingElements();
    if (!screen) return;

    startSimulatedProgress();

    if (document.readyState === "complete") {
      completeLoading();
    } else {
      window.addEventListener(
        "load",
        () => {
          if (!isPageLoaded) {
            isPageLoaded = true;
            completeLoading();
          }
        },
        { once: true }
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLoader, { once: true });
  } else {
    initLoader();
  }
})();
