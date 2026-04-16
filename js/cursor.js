// cursor.js - Standalone custom cursor for all pages
(function () {
    // Only on fine-pointer devices (non-touch)
    if (!window.matchMedia("(pointer: fine)").matches) return;

    // Inject cursor elements if not already in DOM
    if (!document.getElementById("cursor-dot")) {
        const dot = document.createElement("div");
        dot.id = "cursor-dot";
        dot.className = "cursor-dot";
        document.body.appendChild(dot);
    }
    if (!document.getElementById("cursor-outline")) {
        const outline = document.createElement("div");
        outline.id = "cursor-outline";
        outline.className = "cursor-outline";
        document.body.appendChild(outline);
    }

    const curDot = document.getElementById("cursor-dot");
    const curOutline = document.getElementById("cursor-outline");

    let curX = 0, curY = 0, outX = 0, outY = 0;

    window.addEventListener("mousemove", (e) => {
        curX = e.clientX;
        curY = e.clientY;
        curDot.style.left = curX + "px";
        curDot.style.top = curY + "px";
        // Make dot visible when mouse first moves
        curDot.style.opacity = "1";
        curOutline.style.opacity = "1";
    });

    function animate() {
        outX += (curX - outX) * 0.15;
        outY += (curY - outY) * 0.15;
        curOutline.style.left = outX + "px";
        curOutline.style.top = outY + "px";
        requestAnimationFrame(animate);
    }
    animate();

    document.addEventListener("mouseover", (e) => {
        if (e.target.closest("a, button, .card, [role='button']")) {
            curOutline.classList.add("hover-state");
        }
    });
    document.addEventListener("mouseout", (e) => {
        if (e.target.closest("a, button, .card, [role='button']")) {
            curOutline.classList.remove("hover-state");
        }
    });
    document.addEventListener("mouseleave", () => {
        curDot.style.opacity = "0";
        curOutline.style.opacity = "0";
    });
    document.addEventListener("mouseenter", () => {
        curDot.style.opacity = "1";
        curOutline.style.opacity = "1";
    });
})();
