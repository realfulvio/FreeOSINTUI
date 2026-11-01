# Recupero provider e collaudo autenticato — 1 novembre 2026

Aggiornamento del [collaudo iniziale](2026-11-01-live-integrations.md). Le prove sono state eseguite con build Svelte e Wrangler locale su `localhost:8788`, anche in Chrome. Nessun deploy Cloudflare.

## Ethereum

Blockscout alternava risposte valide e HTTP 500: non era un errore di decodifica degli importi. Ora ogni sezione ritenta una sola volta gli HTTP 500/502/503/504, dopo un secondo; annullamento e HTTP 403/404/429 interrompono quel percorso senza ulteriori tentativi.

Se il riepilogo resta indisponibile per un errore temporaneo o di rete, viene richiesto **solo il saldo** con `eth_getBalance` al [PublicNode Ethereum RPC](https://ethereum.publicnode.com/). Non vengono inviati fondi, aperti wallet o richieste firme. La risposta JSON-RPC è validata e i wei restano BigInt. Origine e limitazioni appaiono nell'interfaccia e nei report; il fallback non inventa conteggi, cronologia, tipo di account o etichette.

Prova reale su `0x0000000000000000000000000000000000000001`: in Chrome saldo **57,256761 ETH**, contatore **10.398 transazioni**, **246.572 trasferimenti token** e pagina transazioni caricata. Sono valori osservati al momento del test; la pagina delle transazioni non è la cronologia completa. In una prima esecuzione il solo contatore falliva, mantenendo saldo e transazioni disponibili.

Prova controllata aggiuntiva in Chrome: bloccati temporaneamente soltanto gli URL API Blockscout tramite DevTools; il fallback ha recuperato **57,256761 ETH da PublicNode reale** e mantenuto contatori/transazioni sconosciuti. Il blocco di rete è stato rimosso subito dopo. Questa prova distingue il guasto simulato dalla risposta RPC reale.

## Archivi

Una ricerca estesa può fallire anche se una richiesta limitata riesce. Le query restano passive, verso i soli provider; non viene contattato il dominio cercato.

- **Common Crawl:** ogni query ha un timeout di 15 secondi. Solo per errori temporanei/rete, un singolo fallback richiede al massimo 5 acquisizioni dallo stesso indice e con lo stesso ambito. L'avviso di copertura parziale resta presente anche quando arrivano meno di 5 risultati. Indici non disponibili non cancellano i dati degli altri.
- **Wayback CDX:** se la query estesa fallisce per timeout/5xx, una sola richiesta puntuale cerca al massimo 5 acquisizioni della homepage. È marcata esplicitamente come `homepageOnly` e incompleta, anche con zero risultati. Altri percorsi e sottodomini non vengono dichiarati controllati. Due richieste al massimo, ciascuna limitata a 15 secondi e 2 MiB.
- Nessun fallback aggira errori di accesso o limiti di frequenza. Risposte HTML di errore con HTTP 200 e liste Common Crawl malformate non diventano falsi risultati vuoti.
- UI e report conservano gli avvisi. Le date sono ora descritte come prima/ultima acquisizione **fra quelle caricate**, senza promettere una cronologia completa; le porte non standard restano distinte.

Prova reale `example.com` in Chrome: Common Crawl **316 acquisizioni** nell'indice ottobre, **5** nell'indice settembre e **5** in agosto mediante query ridotte. Wayback ha recuperato **5 acquisizioni della homepage** dopo il timeout della query estesa. Unione: **4 URL distinti**. Sono risultati utili ma incompleti, non la prova che non esistano altri URL.

## URLhaus e ThreatFox

Profilo abuse.ch completato e Auth-Key generata tramite la sessione Chrome autorizzata. La chiave è configurata in `.dev.vars`, escluso da Git, permessi `0600`. Verificata assenza della chiave negli artefatti frontend; nessun valore inserito in documentazione, log di test o repository. La configurazione è **locale**: il secret del Worker di produzione andrà impostato prima del deploy.

| Prova autenticata                                    | Esito                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| URLhaus host `example.com`                           | `listed`, 4 URL, 0 online; tag tra cui `honeypot`. Una segnalazione non prova che il dominio sia pericoloso. |
| URLhaus URL `https://example.com`                    | `configured: true`, `listed: false`. La query URL esatta e quella host hanno ambiti diversi.                 |
| ThreatFox `example.com`                              | `not_listed`, HTTP 200.                                                                                      |
| ThreatFox, IOC pubblico recente ottenuto dalla fonte | `listed`, HTTP 200. L'IOC è stato cercato nel database, mai contattato.                                      |
| UI reputazione in Chrome                             | Entrambe le fonti autenticate mostrano risultati, senza “non configurata”.                                   |

La Community API è soggetta al fair use, non a disponibilità garantita: [URLhaus](https://urlhaus.abuse.ch/api/), [ThreatFox](https://threatfox.abuse.ch/api/), [portale Auth-Key](https://auth.abuse.ch/).

## Limiti operativi

Nessuna modifica può garantire che un provider terzo risponda sempre. I fallback conservano ciò che è verificabile e distinguono ciò che manca. Non sono stati collaudati tutti i siti WhatsMyName, un profilo Gravatar positivo o il percorso di rete della produzione Cloudflare; non è stato aggiunto storage a pagamento.

## Verifiche automatiche

618 test frontend e 130 test Worker superati (748 totali), lint, tipi Worker, build e dry-run Wrangler riusciti. Test dedicati a retry limitato, annullamento durante backoff, 403/429 senza retry, validazione JSON-RPC, precisione BigInt, fonte del saldo nei report, scope homepage e avvisi di copertura ridotta. Upload Worker: 238,03 KiB / 69,49 KiB gzip.
