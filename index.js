const plyr = new Plyr("#plyr");
plyr.on("enterfullscreen", () => screen.orientation.lock("landscape-primary").catch(() => {}));
plyr.on("exitfullscreen", () => screen.orientation.lock("natural").catch(() => {}));
const player = document.querySelector("#plyr");
const nonReportableError = (error) => {
    document.querySelector("#error").innerText = error;
    document.querySelector("#error").classList.add("active");
};

const createErrorModal = async (title, error, info, params) => {
    let urlParams = new URLSearchParams(params).toString();
    const modalHTML = `<div class="modal">
        <div class="modal-content">
            <div class="modal-title">
                <h1>${title}</h1>
                <div class="close" onclick="closeModal()"></div>
            </div>
            <p>${error}</p>
            <div class="technical-info">
                <h3>Informazioni tecniche</h3>
                <a onclick="copyInfo()">Copia</a>
            </div>
            <div class="code" onclick="copyInfo()">${info}</div>
            <p id="report-error">Per favore segnala questo errore via GitHub o email. Cliccando su uno dei pulsanti qui sotto le informazioni principali dell'errore verranno compilate automaticamente.</p>
            <div class="modal-buttons">
                <a class="button primary" href="https://github.com/ZapprTV/channels/issues/new?${urlParams}" target="_blank">Segnala tramite GitHub</a>
                <a class="button secondary" href="mailto:zappr@francescoro.si?subject=${params.title}&body=${
                    encodeURIComponent(`Informazioni tecniche: ${params.info}

Per favore specifica qui sotto se il canale funziona da altre parti (su altri siti o in HbbTV) e su che browser dà errore:

`)
                }" target="_blank">Segnala tramite email</a>
            </div>
        </div>
    </div>`;

    if (document.querySelector(".modal") === null) {
        document.body.insertAdjacentHTML("beforeend", modalHTML);
    } else {
        (document.querySelector(".modal")).outerHTML = modalHTML;
    };

    await new Promise(resolve => setTimeout(resolve, 500));

    (document.querySelector(".modal")).classList.add("is-visible");
};
window["closeModal"] = () => {
    document.querySelector(".modal").classList.remove("is-visible");
};

const searchParams = new URLSearchParams(new URL(location.href).searchParams);
const type = searchParams.get("type");
const url = searchParams.get("url");
const name = searchParams.get("name");
const lcn = searchParams.get("lcn");
const logo = searchParams.get("logo");

if (new URL(location.href).protocol === "https:") {
    nonReportableError("ERRORE: Pagina caricata tramite HTTPS.")
} else if (url === null) {
    nonReportableError("ERRORE: Nessun URL specificato.")
} else if (name === null && lcn === null) {
    nonReportableError("ERRORE: Nome o LCN del canale non specificati.");
} else {
    document.title = `${name} - Zappr (HTTP)`;
    if (logo != null) {
        const img = document.querySelector("img");
        img.src = logo;
        const canvas = document.querySelector("canvas");
    
        const generateMetadataImage = () => {
            const ctx = canvas.getContext("2d");
            const canvasSize = canvas.width;
            const aspectRatio = img.width / img.height;
            let drawWidth, drawHeight, offsetX, offsetY;
    
            if (aspectRatio > 1) {
                drawWidth = canvasSize;
                drawHeight = canvasSize / aspectRatio;
                offsetX = 0;
                offsetY = (canvasSize - drawHeight) / 2;
            } else {
                drawWidth = canvasSize * aspectRatio;
                drawHeight = canvasSize;
                offsetX = (canvasSize - drawWidth) / 2;
                offsetY = 0;
            };
    
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            canvas.toBlob((blob) => {
                const artworkURL = URL.createObjectURL(blob);
        
                if ("mediaSession" in navigator) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: `${name} - Zappr (HTTP)`,
                        artist: "In riproduzione",
                        artwork: [{
                            src: artworkURL,
                            sizes: "512x512",
                            type: "image/png"
                        }],
                    });
                };
            });
        };
    
        img.addEventListener("load", () => generateMetadataImage());
        if (img.complete) generateMetadataImage();
    } else {
        if ("mediaSession" in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: `${name} - Zappr (HTTP)`,
                artist: "In riproduzione"
            });
        };
    };

    switch(type) {
        case "hls":
            if (!Hls.isSupported()) {
                player.src = url;
            } else {
                const hls = new Hls();
                hls.on(Hls.Events.ERROR, (event, data) => createErrorModal(
                    "Errore canale (HLS)",
                    `Impossibile caricare <b>${name}</b> <i>(${data.response.url})</i>: ${data.response.code} ${data.response.text}`,
                    JSON.stringify(data),
                    {
                        template: "hls.yml",
                        labels: "Errore,HLS,HTTP",
                        title: `[ERRORE HLS] ${lcn} - ${name}: ${data.response.code} ${data.response.text}`,
                        name: name,
                        lcn: lcn,
                        info: JSON.stringify(data)
                    })
                );
                hls.loadSource(url);
                hls.attachMedia(player);
            };
            player.play();
            break;
    
        case "dash":
            const dash = dashjs.MediaPlayer().create();
            dash.initialize(player, url, true);
            dash.on("error", event => createErrorModal(
                "Errore canale (DASH)",
                `Impossibile caricare <b>${name}</b> <i>(${url})</i>: ${event.error.data.response.status} ${event.error.data.response.statusText}`,
                JSON.stringify(event),
                {
                    template: "dash.yml",
                    labels: "Errore,DASH,HTTP",
                    title: `[ERRORE DASH] ${lcn} - ${name}: ${event.error.data.response.status} ${event.error.data.response.statusText}`,
                    name: name,
                    lcn: lcn,
                    info: JSON.stringify(event)
                })
            );
            
            break;
    
        case "flv":
            const mpegtsPlayer = mpegts.createPlayer({
                type: "flv",
                isLive: true,
                url: url
            });
    
            mpegtsPlayer.attachMediaElement(player)
            mpegtsPlayer.load();
            mpegtsPlayer.play();
            break;
    
        case "direct":
            player.addEventListener("error", e => {
                createErrorModal(
                    "Errore canale (Diretto)",
                    `Impossibile caricare <b>${name}</b> <i>(${url})</i>.`,
                    "Nessun'informazione disponibile",
                    {
                        template: "diretto.yml",
                        labels: "Errore,Diretto,HTTP",
                        title: `[ERRORE DIRETTO] ${lcn} - ${name}`,
                        name: name,
                        lcn: lcn,
                        info: url
                    }
                );
            });
            player.src = url;
            player.play();
            break;

        case null:
            nonReportableError("ERRORE: Tipo della stream non specificato o non valido.");
    };
}
