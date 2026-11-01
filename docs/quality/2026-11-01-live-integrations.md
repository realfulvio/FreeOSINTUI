# Collaudo delle integrazioni reali — 1 novembre 2026

**Aggiornamento successivo:** vedere [recupero dei provider e collaudo autenticato](2026-11-01-provider-recovery.md). Gli esiti qui sotto restano la fotografia del primo collaudo, precedente alle correzioni e alla configurazione della chiave.
Prove su `localhost:8788` con Wrangler locale, frontend compilato e richieste reali, senza mock. Le risposte fotografano questo ambiente e questo momento: non certificano disponibilità futura né il comportamento della rete Cloudflare in produzione.

## Metodo riproducibile

```sh
npm run build
npx wrangler dev --local --port 8788
# In un altro terminale:
RUN_LIVE_INTEGRATIONS=1 npx vitest run src/lib/live.integration.spec.js
```

`LIVE_BASE_URL` permette di cambiare l'origine del Worker. Il riepilogo viene scritto in `/tmp/tracepunk-live-integrations.json`. Il test verifica l'esecuzione dei controlli: un test verde **non significa che tutti i provider siano disponibili**. Leggere ogni `outcome`: `data`, `partial`, `unavailable`, `not_configured`. Il test è escluso per default dalle chiamate di rete della CI. Massimo due prove concorrenti, nessuna scansione urlscan creata, solo due controlli username GitHub. Le fixture sono pubbliche o sintetiche, mai credenziali reali.

## Risultati del runner Node

Ora UTC: 2026-11-01T19:00:22.749Z. `data` indica una risposta elaborata, non completezza dell'intero archivio o un verdetto di sicurezza.

| Controllo                  | Esito          | Dettaglio                                                                                                                                                                       |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DNS A                      | data           | {"answers": 2}                                                                                                                                                                  |
| DNS AAAA                   | data           | {"answers": 2}                                                                                                                                                                  |
| DNS MX                     | data           | {"answers": 1}                                                                                                                                                                  |
| SPF/DMARC                  | data           | {"spf": true, "dmarc": true}                                                                                                                                                    |
| Domain RDAP                | unavailable    | rdap.org answered with HTTP 403.                                                                                                                                                |
| IP RDAP                    | unavailable    | rdap.org answered with HTTP 403.                                                                                                                                                |
| IP geolocation             | data           | parsed                                                                                                                                                                          |
| PTR                        | data           | parsed                                                                                                                                                                          |
| IP InternetDB              | data           | parsed                                                                                                                                                                          |
| Disposable list            | data           | parsed                                                                                                                                                                          |
| HIBP password fixture      | data           | {"knownFixtureFound": true}                                                                                                                                                     |
| XposedOrNot reserved email | data           | {"breaches": 0}                                                                                                                                                                 |
| Gravatar reserved email    | data           | {"profilePresent": false}                                                                                                                                                       |
| GitHub profile             | data           | {"login": "octocat"}                                                                                                                                                            |
| GitHub orgs                | data           | parsed                                                                                                                                                                          |
| GitHub repos               | data           | parsed                                                                                                                                                                          |
| GitHub keys                | data           | parsed                                                                                                                                                                          |
| Crypto btc                 | data           | {"sections": {"summary": "done", "transactions": "done"}, "transactions": 50, "balanceKnown": true}                                                                             |
| Crypto ltc                 | data           | {"sections": {"summary": "done", "transactions": "done"}, "transactions": 50, "balanceKnown": true}                                                                             |
| Crypto eth                 | unavailable    | Balance and account: eth.blockscout.com answered with HTTP 500.; Counters: eth.blockscout.com answered with HTTP 500.; Transactions: eth.blockscout.com answered with HTTP 500. |
| Wayback availability       | unavailable    | archive.org is rate limiting requests. Try again in a minute.                                                                                                                   |
| Certificate transparency   | data           | {"source": "crt.sh", "names": 6, "partial": false}                                                                                                                              |
| Reputation otx             | data           | {"status": "not_listed"}                                                                                                                                                        |
| Reputation sfs             | data           | {"status": "not_listed"}                                                                                                                                                        |
| Short URL redirect         | data           | {"status": 301, "destination": "http://github.com/sthnaqvi/follow-redirect-url", "method": "HEAD"}                                                                              |
| Telegram official channel  | data           | {"exists": true, "type": "channel", "keys": ["username", "url", "exists", "type", "title", "verified", "description", "image", "extra", "counters", "posts"]}                   |
| Common Crawl               | data           | {"indexes": 1, "records": 5}                                                                                                                                                    |
| urlscan existing scans     | data           | {"total": 2876, "loaded": 10}                                                                                                                                                   |
| Tor exit list              | data           | {"status": "not_listed"}                                                                                                                                                        |
| Spamhaus DROP              | data           | {"status": "not_listed"}                                                                                                                                                        |
| URLhaus config             | not_configured | {"status": "not_configured"}                                                                                                                                                    |
| ThreatFox config           | not_configured | {"status": "not_configured"}                                                                                                                                                    |
| URLhaus URL config         | not_configured | {"configured": false}                                                                                                                                                           |
| Wayback CDX                | unavailable    | HTTP 504: The source did not answer in time.                                                                                                                                    |
| Username GitHub known      | data           | {"status": "found", "http": 200, "reason": "HTTP 200 and the profile marker is present"}                                                                                        |
| Username GitHub absent     | data           | {"status": "not_found", "http": 404, "reason": "HTTP 404 and the 'not found' marker is present"}                                                                                |

## Verifica nell'interfaccia del browser

| Flusso                                            | Risultato osservato                                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dominio `example.com`                             | DNS A/AAAA/MX/NS/TXT/SOA, null MX, SPF e DMARC corretti; RDAP con registrar e date; snapshot Wayback disponibile nella prima prova; nell’ultima il runner riceve HTTP 429 (rate limit).                                                                                                         |
| Certificate transparency                          | crt.sh non raggiungibile; fallback Cert Spotter con 2 nomi e avviso esplicito di lista parziale.                                                                                                                                                                                                |
| IP `1.1.1.1`                                      | Geolocalizzazione, PTR, RDAP e InternetDB visualizzati. I dati di localizzazione sono quelli del provider, non una posizione fisica verificata.                                                                                                                                                 |
| RDAP                                              | Funziona per dominio e IP nel browser. Il 403 del runner Node è una differenza osservata fra i due percorsi di rete, non un errore da nascondere con risultati vuoti.                                                                                                                           |
| Email sintetica sul dominio riservato example.com | Lista usa-e-getta caricata, null MX riconosciuto, SPF/DMARC, assenza di profilo/avatar Gravatar. Non verificato un profilo Gravatar esistente.                                                                                                                                                  |
| XposedOrNot                                       | Email sintetica non presente, con avviso che questo non prova l'assenza di ogni breach.                                                                                                                                                                                                         |
| HIBP                                              | Fixture pubblica `password` riconosciuta come esposta; UI mostra il solo prefisso SHA-1 `5BAA6` usato nella richiesta.                                                                                                                                                                          |
| GitHub `octocat`                                  | Profilo e repository della mascotte pubblica caricati; quota API visibile. Il runner verifica anche organizzazioni e chiavi.                                                                                                                                                                    |
| Bitcoin / Litecoin                                | Saldi, totali e transazioni reali caricati. La finestra di transazioni non equivale alla cronologia completa.                                                                                                                                                                                   |
| Ethereum / Blockscout                             | Le tre sezioni rispondevano nella prima prova Node; nell’ultima anche Node restituisce HTTP 500, come il browser, mostrati come errori senza saldi zero inventati. Disponibilità browser non certificata.                                                                                       |
| Reputazione `1.1.1.1`                             | OTX, StopForumSpam, Tor e DROP rispondono; riepilogo distingue quattro fonti controllate da due non configurate.                                                                                                                                                                                |
| URL `https://example.com/`                        | Risultati urlscan esistenti e snapshot Wayback visualizzati; nessuna nuova scansione inviata.                                                                                                                                                                                                   |
| Telegram `telegram`                               | Canale ufficiale riconosciuto, verifica, contatori e 10 post pubblici visualizzati.                                                                                                                                                                                                             |
| Archivi completi                                  | Common Crawl: 5 record nell'indice singolo da Node, ma HTTP 504 sui tre indici del flusso browser. Wayback CDX: timeout 504 da Node e HTTP 503 nel browser. Nessuna garanzia di archivio completo.                                                                                              |
| Espansione link brevi                             | `https://is.gd/example` restituisce HTTP 410 senza destinazione. `https://bit.ly/2X7gCIT` restituisce HEAD/301 verso il repository pubblico `sthnaqvi/follow-redirect-url`, senza contattare la destinazione; fixture tratta dal suo [README](https://github.com/sthnaqvi/follow-redirect-url). |
| Username                                          | GitHub User: `octocat` found/200, fixture inesistente not_found/404. Non sono stati provati tutti i siti WhatsMyName: regole e blocchi cambiano per ciascun sito.                                                                                                                               |

## Correzioni emerse dal collaudo

- **Archivi:** quando le fonti falliscono, non mostrare “Nessun URL archiviato trovato”. Il messaggio ora dichiara che il controllo è incompleto, anche nell'esportazione. Vale anche con una sola fonte fallita, indici parziali/troncati o ricerca ancora in corso. Test di regressione dedicati.
- **Importi crypto in italiano:** alcuni runtime Intl non raggruppano il campione a quattro cifre. Il rilevamento del separatore usava quindi una virgola di ripiego, identica al separatore decimale. Campione a cinque cifre e test BigInt: `8.437.414,11250315`, senza conversione a floating point. Messaggio di copertura incompleta e separatore corretto confermato anche nel browser con la nuova build.

## Limiti prima della pubblicazione

URLhaus e ThreatFox richiedono `ABUSECH_AUTH_KEY`, non disponibile in questo ambiente: è stata collaudata solo la gestione “non configurata”, non una risposta autenticata. Nessuna chiave è stata creata o esposta. Restano da verificare risposte riuscite di Ethereum e degli archivi dal browser, le fonti autenticate quando disponibili. Un numero finito di fixture non certifica tutti i provider username o tutti i record possibili.

Gli strumenti interamente locali (hash, metadati, favicon, parser, generatori) non richiedono integrazioni remote: si rimanda ai test e al [precedente audit](2026-11-01-tool-audit.md). Nessun deploy, nessuna nuova risorsa Cloudflare e nessuna modifica al piano di fatturazione. Dopo un eventuale deploy servirà uno smoke test dell'origine effettiva: il runtime locale non prova le quote CPU o il percorso di rete Workers Free.

## Controlli automatici

599 test frontend e 126 test Worker superati (725 in totale); smoke test live separato, lint, controllo tipi Worker, build e dry-run Wrangler riusciti. Upload Worker invariato: 237,60 KiB / 69,29 KiB gzip.
