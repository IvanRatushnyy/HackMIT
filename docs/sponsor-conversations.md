# Sponsor conversations — Henry Wei, MD (Regeneron)

Two in-person mentoring conversations at HackMIT, Sept 19, 2026. Henry Wei is the sponsor contact and a judge (ex-Google, Aetna, White House; Cornell Med faculty). Raw speech-to-text transcripts are held by the team; this is the distilled version with verbatim quotes kept where the wording matters. Also summarized: the four Regeneron starter-kit PDFs and the team's own pre-pivot discussion.

Use this doc to answer "what did the sponsor actually ask for?" Requirements marked **[post-PRD]** were raised in the second conversation and are not in `PRD Elute.md`.

---

## Conversation 1 — orientation (~25 min)

**Where the pain is in clinical development.** Study startup and site startup are "notoriously one of the most painful, complicated and highly variable things"; recruitment is next. Getting data entered at sites is "somewhere in between hackathon-ready versus not." Upstream bottlenecks matter most.

**On aiming at Regeneron vs the healthcare track.** The challenge title steers toward clinical and biostatistics "because my colleagues can judge those more easily," but discovery-side work "doesn't preclude you." Starter kits from the molecular-profiling team exist; a discovery project needs a Sunday judge other than Henry — tell him early.

**Tools he named.** ToolUniverse (Marinka Zitnik's lab, Harvard) and its repurposing agent TxAgent; the TxGNN foundation model for repurposing; "Biotech in a Box" (James Zou's lab, Stanford) for target validation.

**What repurposing reasoning must include.**
- Summarize what the biomedical literature says, *and* present "a chain of reasoning ... because this drug acts on this pathway and we know this happens in animals and this pathway does this."
- Check the opposite: "you don't just randomly give drugs that seem to light up in a petri dish because of the safety issue." Safety profile of on-market drugs is known; hitting other targets → heart, reproductive system, liver ("this person's liver is so shot and this drug hits the liver").
- Downstream target engagement: whether the drug "is not only engaging its molecular targets ... but what's the next most likely thing to happen downstream that would light up as another signal of confidence." *Drug → target → pathway → protein → phenotype; the protein is a biomarker.*
- Metformin "repeatedly comes up" as a repurposing example. Atul Butte's 2013 antidepressant-vs-tumor finding as an early ML repurposing case that never got industrialized.
- Repositioning classically lives in neurodegenerative and rare disease, where pathways are poorly understood and trials are long and nobody wants the placebo arm.

**On trust and explanation.** *"It's not that I don't believe you. I don't understand what your rationale is."* Chain-of-thought tokens are "not how scientists think ... I have some prior knowledge of how that graph of knowledge or mechanisms work. So being able to map to that." *"Assume that you've done this wrong. Try and defend what it is that you're coming up with."*

**On belief vs knowledge.** Regeneron's co-founder "made a living off of separating out what people believe versus what they actually know" — the knockout-mouse story: published phenotypes that "were perfectly normal" when the company made the mice itself. *"It's been published. That doesn't mean it's actually — it's not that they're lying, but they might have not been able to replicate it."* A HackPrinceton team got an honorable mention from a starter sheet about "calling BS on papers": detecting problems that mean "you might need to revisit how much you believe that."

**Reasons a paper's claim may not hold (his list, recorded by the team):** small sample · inappropriate statistical analysis · poor controls · no replication · conflicting later evidence · citation chain ultimately depending on one study · animal evidence generalized to humans · cell-line evidence generalized to patients.

**Safety checklist when recommending a drug (team notes):** liver toxicity · cardiac effects · reproductive toxicity · drug interactions · dose limits.

**Real-world data.** Off-label prescribing is a signal, but "some drug companies were very irresponsible and basically marketed an unapproved indication" — a tightrope. No good hackathon-accessible RWD source (All of Us takes too long); synthetic datasets in the starter kit can show it "could theoretically work on data like that."

**On packaging.** "The skill sets of folks to go and run command line agents is still limited." Put it "into some type of user interface so that everyone can get to it"; expose the backend for IT, who "will often want to [check] it's not running tools and dependencies and packages that are inappropriate, or there's a supply chain risk." Half the battle is a reasonable output; "the other huge half is explaining why, and being self-critical."

---

## Conversation 2 — feedback on the mocked-up flow

**Auto-scientists.** Google Co-Scientist, Edison Scientific's Cosmos, a Stanford one. The good pattern: "they won't know the answer, but they'll know the question that needs to be answered and how to answer that question" → the tool should propose the experiment or data that would move confidence, i.e. a research agenda. Roivant rescued drugs Pfizer out-licensed by "having a better way of managing that uncertainty."

**Knowledge graphs as the justification surface.** The Zitnik lab's approach: justification "is on that graph, not necessarily in a publication ... you can double-click into what are the pieces of literature that support that knowledge."

**[post-PRD] Failed trials as an invalidation signal.** Google Co-Scientist's mistake: it proposed a receptor as a target when "all the clinical trials for that target failed, like 10 years ago." Targets fail because "the disease might have been related to multiple pathways affecting the same thing" — the body reroutes. *"You really want to nail down corroborating all of these different sources of information."* → Query failed/terminated trials on the **target**, not only the drug. Ten companies chasing a target is itself evidence someone looked — "except they all got it wrong."

**[post-PRD] Targetability — "the fine print underneath it is where the money is."**
- Chemicals-only databases miss "the swath of large molecules that can actually hit these targets" (antibodies, bispecifics, siRNA, cell therapy). GLP-1 drugs are "technically in the biotech space."
- "The cell surface is much easier to target than if this thing is sitting on some pathway inside of the cell. And if it's in the nucleus, we got to figure out siRNA or some gene editing or gene therapy." Not docking; delivery to the compartment.
- Tissue breadth: a target "might be expressed in so many other tissues that ... unless you hit it specifically in the organ of relevance, you're going to mess the other tissue and have severe side effects." Loss-of-function genetics cuts both ways: silence a gene for cardio-metabolic benefit and "you also look at what bad things might happen to those people too, maybe cancer."
- Route/compartment: the blood–brain barrier is "a very secure TSA checkpoint." For nilotinib-PD his central question: "is it just because they didn't actually deliver it into the right compartment of the body?" Intrathecal delivery exists but "people don't do that." Regeneron's VEGF-in-the-eyeball story: the route was the invention.

**[post-PRD] Genetic validation — the biggest objection he is "censoring."** Regeneron finds targets through "the natural experiment of human genes" (variant → expression → function → loss-of-function outcome). We won't have that data. "Partner some type of genetic module that looks through publications ... or leave a parking spot for something to go out to an MCP someday that says, go do this Mendelian randomization for us." Ask AI "how do companies actually validate targets and just get the overall superstructure, knowing that you have several under-construction lanes."

**[post-PRD] Pathway as a story, and a diagram.** "If you can actually elegantly display the rationale — this is the pathway, this is what we think, and here's the experiments that have been done to confirm that this pathway — then it's a story rather than a collection of data." Good scientists recognize a known pathway vs a novel claim; that becomes the roadmap for experiments. BioRender-style diagrams; STRING DB network graphs are understood by translational scientists but hard for everyone else. Image-generation models produce "garbled" scientific diagrams — use structured drawing. Analogy for blood pressure: block any of A → B → C in the renin–angiotensin cascade and get a similar effect — that is what makes a pathway argument plausible.

**On the mocked-up results table.** "This table is actually okay." Best evidence (a phase 3 trial) is the top signal; the harder case is "if there were no clinical trials, why do we actually go and proceed with them?" → two layers: best evidence, and in its absence a ranking with an expandable justification ("accordion style ... what exists and then what if").

**[post-PRD] Surveillance.** "If the objection doesn't exist yet ... it becomes a surveillance mechanism ... keep an eye out for any studies that go either way." Drug development takes a decade; new evidence mid-program is hard to catch "once the train has left the station." Valuable to biotechs, pharma, and investors.

**Backtest / rediscovery.** Co-Scientist tried to "rediscover something that has subsequently been discovered." His framing of our nilotinib case: *"If you removed all the clinical trials, how would you have known it was going to fail?"* The negative direction ("all the reasons why maybe not") is the differentiator; the positive-direction tools already exist. Extending it to "we knew this was going to be successful" is a trial-prediction engine.

**The most delicate audience.** Patients "would kind of abuse this in ways they don't understand" — a wall of "we don't know if this works" could scare people off trials that are their best option; side effects have mitigations (GLP-1 nausea) or acceptable trade-offs. If aimed at patients, the frame is "how do you help patients decide what trials to do."

**Presentation and export.** The appraisal "is going to justify a decision to someone": an investor thesis, an internal deck "to help people get comfortable and debate something," or a grant form. Expert decks list "the things we need to answer in order to make a decision" and walk through evidence good, bad, or equivocal. **[post-PRD] "Throw a PowerPoint button on this thing ... you would be shocked at how popular that feature is."** Also: be opinionated about what the user should do next (the user journey after export), and AI-summarize dense source lists rather than showing links.

**Who pays.** Large pharma "would try and build internally" (they have proprietary experiment data); small biotechs outsourcing to CROs are where innovation and need are; investors are a buyer. Release free with a contact form. A Viva/Salesforce lesson: ask "what do you use today?" and listen for complaints, not "would you pay?" Products that leave time or money in the customer's pocket get value shared back.

**Process advice.** Use a critic persona: "take on the persona of a very seasoned drug discovery research expert. What would they do to critique the output of this, and then iteratively round off those, or at least create yourself parking spaces." Write a PRFAQ (two-page press release) if stuck at 2 a.m. — intent-rich context makes coding agents perform better ("Oh, you're trying to build one of those"). Explore many mocked-up interfaces and personas with agents, then pick. Expect throttled APIs: "See if you can gracefully fail. Like, if one thing fails..."

**Judging.** Hackathons are harder to judge because of code agents; MLH judges flip through the repo at the winner stage. Hard-coded demos with empty repos are the failure mode. "We place a higher value on realistically being able to use the tool as opposed to it just being a quick demo." → *Can you get the system actually operational against a new dataset?* Show a live second query.

**Logistics.** Henry is on Discord; his phone was failing; mentors offline until Sunday morning. He drops general tips into a shared folder for fairness (never team-specific ideas). Kim (a VC) is the healthcare-track contact.

---

## Regeneron starter kits (four PDFs in `~/Downloads`, downloaded Sept 19 13:42)

**Agentic Clinical AI Platform (1 page) — the sheet we align with most.** "Build a multi-agent AI system designed to autonomously execute and orchestrate clinical drug development tasks" from natural language. **Must connect to ToolUniverse** (Zitnik Lab) for Open Targets, NCBI, GWAS catalogs, interaction networks. Focus areas: (1) protocol simulation of attrition from historical trial data; (2) "seamless integration with at least 3 distinct tools via Harvard's ToolUniverse"; (3) "show the agent's 'chain of thought' — how it evaluates tool outputs, decides its next steps, and self-corrects if a database query fails."

**Structural & Neurosymbolic AI Trial Prediction (2 pages).** Reason over structural representations / knowledge graphs, not text. 24-hour strategy: use PrimeKG; take an **NCT number**, extract intervention and disease, map them into the graph, use shortest path / structural embeddings to judge "the physical and biological plausibility of the drug reaching its target and affecting the disease mechanism." Resources: Elorian AI (arXiv:2507.06261), ClinicalTrials.gov API v2, PrimeKG, Open Targets.

**Origin Story (11 pages) — the flagship, not our track, but it carries the judging voice and the data catalogue.** Rewind Alzheimer's/Parkinson's spread to a seed region on a connectome. Data catalogue (no account): Open Targets GraphQL (`api.platform.opentargets.org/api/v4/graphql`), GTEx v2, Europe PMC REST, ClinicalTrials.gov API v2, Ensembl REST, MyGene/MyVariant, NCBI E-utilities, CELLxGENE, SEA-AD, HCP, OSF connectome. Warning for its "language and agents" track: *"an LLM wrapper with nothing underneath is the single most common thing judges get shown all weekend. The language layer has to sit on top of real computation."* **What impresses:** "It runs. Live. From a cold start." · "You validated against something already known." · "You clearly labeled what is measured data and what is simulated. Every time." · "You can name one thing your model gets wrong." · "You made a deliberate decision about what NOT to build." **What won't land:** animation with nothing computing; unvalidated ML; any claim of clinical utility; deck with no code; "waiting on data access." Landmine: never claim the tool diagnoses, predicts, or stages disease in real patients.

**Automated Software Validation (2 pages).** GxP validator as a Claude skill in CI/CD. Not relevant.

Also referenced by Henry and the PRD but not on disk: *Scientific credibility of sources* and *AECausality* ("cannot determine" as a valid output) starter sheets.

---

## Team pre-pivot discussion (before Henry)

The teammate's prior DubHacks project: RNA-seq expression matrix (patients as columns, genes as rows, normalized counts) → differential expression between two groups (healthy/unhealthy, cancer subtypes such as lung adenocarcinoma vs squamous) → volcano plot (log2 fold change vs confidence) → over-expressed genes as candidate targets; a chat interface with one MCP server for STRING DB protein–protein interaction. Team's own critique: "very simplistic MVP," "pretty much just a chat interface," needed constant explaining. Direction agreed: pivot to drug repurposing, build a proper harness with MCP-style tools ("it's the same exact models except they have just better harnesses"), tailor to Regeneron, tell the team's backgrounds (Fred Hutch, a Navy research lab) and personal cancer stories in the pitch. Inspiration: a TreeHacks project that guided researchers through every stage of drug repurposing.
