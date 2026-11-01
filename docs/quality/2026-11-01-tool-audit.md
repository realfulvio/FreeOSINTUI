# TRACEPUNK — audit funzionale prima della pubblicazione

Revisione del 1 novembre 2026, base `5466a2d`. Nessun deploy e nessuna ricerca su persone reali. Questa è una revisione mirata del codice, non una certificazione completa dei 20 strumenti né un confronto prestazionale con upstream.

## Risultati riprodotti

Otto prove diagnostiche su risposte sintetiche sono passate: confermano il comportamento attuale **difettoso**, non la correttezza desiderata. Il sorgente è conservato in `2026-11-01-audit-probes.txt`, fuori dalla suite normale per non cristallizzare i bug. Per ripetere: copiare temporaneamente quel file in `src/lib/prepublication.audit.spec.js`, eseguire `npx vitest run src/lib/prepublication.audit.spec.js`, poi rimuovere la copia. Le correzioni dovranno avere test con aspettative opposte.

| Priorità | Strumento / file                                                                                | Evidenza                                                                                                                   | Correzione proposta e criterio di accettazione                                                                                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Data breach — `src/lib/leaks/xposedornot.js`                                                    | HTTP 200 con `{maintenance:true}` restituisce `[]`.                                                                        | Validare la forma della risposta e distinguere assenza documentata da risposta inattesa. Un payload di errore non deve produrre un risultato negativo.                                             |
| P1       | Password esposte — `src/lib/leaks/pwned-passwords.js`                                           | HTML al posto della lista di hash produce conteggio 0.                                                                     | Validare righe e conteggi del protocollo; formato inatteso = fonte non disponibile. Mantenere prefissi hash e padding già presenti.                                                                |
| P1       | Reputazione — `src/lib/reputation/sources.js`                                                   | OTX `{maintenance:true}` e backend `{status:'unexpected'}` diventano `not_listed`.                                         | Schema minimo per fonte e insieme chiuso di stati. Stati ignoti = errore/non disponibile; nessuna rassicurazione implicita.                                                                        |
| P1       | Email e domini — `src/lib/dns/email-auth.js`                                                    | Due TXT SPF (`-all` e `+all`) vengono ridotti al primo e ricevono verdetto `good`.                                         | Rilevare record multipli e invalidi; distinguere ispezione della policy da verifica effettiva del mittente. Aggiungere casi DMARC duplicati, eredità e valori invalidi.                            |
| P1       | Header email e domini somiglianti — `src/lib/headers/address.js`, `src/lib/lookalike/domain.js` | `alice.github.io` e `bob.github.io` risultano stessa organizzazione; il generatore riduce `alice.github.io` a `github.io`. | Unificare il calcolo dei suffissi con una Public Suffix List aggiornata e una politica esplicita sui suffissi privati. Evitare di confondere tenant indipendenti o generare varianti del provider. |
| P2       | Domini somiglianti — `src/lib/lookalike/resolve.js`                                             | A e NS vuoti causano `registered:false`; AAAA/MX non vengono nemmeno interrogati.                                          | Separare “record DNS osservati”, NXDOMAIN, errore e registrazione non verificata. Non dedurre la disponibilità del dominio dall'assenza di A/NS; controllare anche AAAA/MX nei casi opportuni.     |
| P2       | GitHub — `src/lib/github/lookup.js`                                                             | Un errore 503 su un repository rigetta l'intero aggregato delle email dai commit.                                          | Conservare i risultati riusciti, indicare repository falliti e copertura parziale; ritentare solo la parte fallita su richiesta.                                                                   |
| P2       | Tracce negli archivi — `src/lib/footprint/merge.js`                                             | URL con porte 8443 e 9443 hanno la stessa chiave di deduplicazione.                                                        | Conservare le porte non standard e la provenienza degli URL; test con servizi distinti sullo stesso host.                                                                                          |

Riferimenti: [SPF RFC 7208, selezione dei record](https://www.rfc-editor.org/rfc/rfc7208.html#section-4.5), [Public Suffix List](https://publicsuffix.org/). Un risultato assente in una fonte non dimostra sicurezza o inesistenza globale.

## Robustezza e prestazioni da misurare

- **Metadati PDF/Office:** `readMetadata` carica l'intero file; `parseOffice` decomprime in modo sincrono i membri selezionati senza un limite esplicito alla dimensione decompressa. Aggiungere budget di byte/file/tempo e lavorazione annullabile in Web Worker. Non è stato eseguito un test distruttivo di esaurimento memoria.
- **Hash:** la lettura a blocchi e l'annullamento esistono già. I calcoli di tutti gli algoritmi restano sul thread principale. Misurare la reattività su file grandi e dispositivi modesti prima di spostare in Web Worker; consentire di scegliere gli algoritmi può risparmiare lavoro.
- **Crypto:** saldo, contatori e transazioni sono accoppiati con `Promise.all`; una fonte opzionale fallita perde il resto. Restituire sezioni parziali e stato della copertura, senza trasformare dati sconosciuti in zeri. Nessun benchmark o test live del provider eseguito qui.
- **Username:** pool limitato e stato `unknown` esistono già. Migliorie: scansione iniziale mirata, costo in richieste visibile, ripresa e ripetizione dei soli errori. Verificare periodicamente le regole WhatsMyName con fixture note; non equiparare username coincidente a identità personale.
- **URL:** espansione limitata ai servizi consentiti già presente. Esporre perché la catena si ferma (ciclo, limite, servizio non consentito, errore) e separare analisi locale da interrogazioni delle fonti.

## Copertura dei 20 strumenti e prossimi passi

| Strumento          | Esito di questa revisione / miglioramento da valutare                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dork               | Ispezione del generatore; nessun difetto confermato qui. Validare template e caratteri speciali, non aggiungere indiscriminatamente query.                  |
| Hash               | Lettura a blocchi già presente; misurare main thread e selezione algoritmi.                                                                                 |
| Domini             | Correggere SPF; rendere indipendenti le evidenze DNS/auth e riportare fonte/data.                                                                           |
| IP                 | Ispezione dei lookup; validare payload esterni e mantenere distinta assenza dati da assenza di porte/vulnerabilità.                                         |
| Email              | Correggere SPF e preservare MX riusciti se auth fallisce.                                                                                                   |
| Data breach        | Due falsi negativi sintetici riprodotti; priorità alta. Conservare nomi breach anche se il catalogo descrittivo fallisce.                                   |
| Username           | Nessun nuovo bug riprodotto; costo, ripresa e qualità delle regole da migliorare.                                                                           |
| Telefono           | Parsing locale già presente; nessuna necessità di aggiungere un backend. Estendere fixture internazionali e chiarire validità formale versus numero attivo. |
| Telegram           | Non riesaminato integralmente in questo audit; aggiungere fixture per pagine cambiate/limitate e data dell'osservazione.                                    |
| Crypto             | Risultati parziali, copertura transazioni e distinzione sconosciuto/zero.                                                                                   |
| GitHub             | Errore di aggregazione riprodotto; paginazione opzionale entro budget, senza perdere il limite già comunicato per i repository.                             |
| Metadati           | Limiti decompressione, annullamento reale e isolamento del lavoro pesante.                                                                                  |
| Domini somiglianti | Suffissi e interpretazione del DNS da correggere.                                                                                                           |
| Favicon            | Limite di 5 MiB e hashing locale già presenti; nessun nuovo difetto confermato. Verificare periodicamente la sintassi delle ricerche esterne.               |
| Header email       | Suffissi incompleti; distinguere risultati dichiarati negli header dalla loro attendibilità e dalla verifica crittografica.                                 |
| Archivi            | Deduplicazione con porte da correggere; mantenere indicazioni di troncamento già presenti.                                                                  |
| URL                | Migliorare motivi di arresto e prove a supporto delle segnalazioni.                                                                                         |
| ID/date            | Ispezione parziale, BigInt già utilizzato; ampliare casi limite calendario/fusi e ambiguità di formato.                                                     |
| MAC                | Prefissi IEEE più specifici già gestiti; data del dataset e natura locale/randomizzata da mantenere evidenti.                                               |
| Reputazione        | Validazione rigorosa dei payload e degli stati prima di mostrare esiti negativi.                                                                            |

## Ordine di lavoro raccomandato

1. Risposte esterne, SPF, suffissi: impedire conclusioni sbagliate; aggiungere test di regressione.
2. Risultati parziali, DNS e archivi: conservare evidenze senza confondere assenza ed errore.
3. Budget e reattività dei file locali, scansioni selettive: misurare prima/dopo con fixture riproducibili.
4. Verifica delle integrazioni reali con dati pubblici di test e controlli dei limiti; pubblicazione solo dopo le correzioni prioritarie.

Le correzioni funzionali descritte qui **non sono ancora implementate**. Animazioni e ringraziamenti sono una modifica separata richiesta durante la revisione.
