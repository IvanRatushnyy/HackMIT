# Elute — pitch material

**What this file is.** Everything we say *about* the product to judges: the story, the mentor's words, the audiences beyond our user, and the rationale behind features. None of it appears in the product. The product is for one person, the accountable scientist, and it never explains or pitches itself. See `PRD Elute.md` for what we build; this file is why, in the words we'll use on stage.

---

## The story in one breath

In July 2016 a twelve-patient open-label pilot said nilotinib helped Parkinson's. Every objection that would sink it was already public: the drug barely enters the brain (0.53 % CSF/plasma, measured in 2014), the pilot had no placebo arm, and the biomarker rise had a mundane explanation published five months later. Nobody organised those facts. A 76-patient, 25-site placebo-controlled trial ran anyway and was negative. Elute organises the facts.

## The backtest, told as a demo beat

The app has a demo mode that freezes the evidence at a date. At **Nov 2017**, the day NILO-PD enrolled its first patient, the appraisal shows three pre-trial objections and none of the post-trial ones. At **Jul 2016**, the MAO-B objection is absent because it wasn't published yet. This is not a product control; scientists using the tool today don't need history. It is the proof that the tool would have mattered, and it belongs on stage. Rule: every counter-argument is dated before enrolment and derived from sources, not from the outcome.

## What Henry Wei said, and what we did with it

Second conversation, HackMIT, 19 Sep 2026. Verbatim or near-verbatim. Each quote maps to a decision in the PRD's decision log.

**The co-scientist pattern.** *"These co-scientists basically don't answer the question alone, but they say, and this is the experiment you want to do... They won't know the answer, but they'll know the question that needs to be answered and how to answer that question."* → the "before a trial" checklist and the next-experiment line.

**The pathway is the story.** *"You just kind of need something that shows the pathway, the theoretical pathway, and then people, they'll recognize that. Like good scientists will be like, Oh no, no, that's a known pathway versus, Oh, this is novel... And then that's actually your roadmap to saying we're going to design experiments to see if that pathway truly does what we think it does."* And: *"If you can actually elegantly display the rationale in that manner... then it's a story rather than just a collection of data."* → the pathway drawing on Detail.

**Don't generate the picture.** *"Most of the image production AI, for whatever reason, I don't think it actually either has the knowledge or the prompting strategy to do a good job at scratch... it makes a weird garbled what it thinks it is... until you can get a formal API in place."* His example of a formal API was BioRender. → Reactome and Open Targets, which are keyless and return real diagrams, not image models.

**The fine print is where the money is.** *"The cell surface is much easier to target than if this thing is sitting on some pathway inside of the cell... So the reason I'm bringing that up is that that fine print underneath it is actually where the money is, because that one tells you what's actually going on."* → compartment, modality and route on every card. (Making the drug class the largest text on the row is our decision, from the team's notes of the conversation and the class-inference literature; it is not in the transcript.)

**Large molecules count.** *"If it's a chemicals-only database, you're missing the swath of large molecules that can actually hit these targets also."* → modality is a first-class field; biologics are not excluded by the pipeline design (coverage is parked for the weekend).

**Failed trials invalidate; crowded targets corroborate.** *"One way of invalidating targets is to actually look at trials that have failed."* *"There are ten companies chasing it, except they all got it wrong."* And on Google Co-Scientist, relayed second-hand from a colleague who tried it: *"If you just did what Google does and search, you'd see that all the clinical trials for that target failed... like 10 years ago."* → "who else tried this target" on the card; the pipeline's job is to check what an idea generator missed.

**Two registers on the results page.** Asked whether to consolidate the card, thinking aloud: *"Yeah, I don't know, because you have two different things going on. There's best evidence, which is, is there a trial? But then in the absence of trials, all other things being equal, how do I actually give it a ranking? And then how do I blow up that justification?"* → our decision: tested candidates ranked by outcome; untested ranked by a printed plausibility rule; drill-down in place.

**Plausibility without trials.** *"It's actually the angiotensin renin cascade where A leads to B leads to C... you can block any one of those three, and then it tends to produce some type of similar effect. That's what makes some things more plausible. Where things go super haywire... the body has so many branch points."* → pathway precedent as a plausibility driver; branch points as a stated doubt.

**Surveillance.** *"If the objection doesn't exist yet, but you can think, what if there was a study that suddenly showed this? It then becomes a surveillance mechanism... keep an eye out for any studies that go either way."* → parked; the dated-evidence model already supports it.

**The decision artefact.** Two separate passages. On a feature an intern built: *"Throw a PowerPoint button on this thing, because you would be shocked at how popular that feature is."* Later, on how expert humans build decision decks: *"They'll be not opinionated, but they'll try and say, Here are the things we need to answer in order to make a decision. And then they'll kind of walk through all the information, good, bad, or different."* He also said: *"You should be somewhat opinionated about what you think the user should be doing next."* → our decision: the export is a PDF discussion document structured as the questions a decision needs, unbiased on the appraisal itself, with the next experiment named for each open question and never a verdict. He asked for PowerPoint; slides are parked behind the same document model.

**Is it real.** *"Is this real? Is this actually really running, or is it just sort of mocked up?"* On judging, with the caveat that he did not know this track's rubric: *"Certainly some of the other companies in Regeneron included, because it's now possible to use code agents, we place a higher value on realistically being able to use the tool as opposed to it just being a quick demo."* And as advice: *"See if you can gracefully fail."* → at least one surface fetches live with no keys; the README says exactly what is live, curated, draft and scripted.

**Parking spaces.** *"Create yourself parking spaces so that once you have that feature to go and resolve that sort of threat to validity."* He named two: threats to validity from tissue expression and off-target effects, and genetic validation (*"that's a very strong line of evidence that you won't have access to... leave a parking spot for something to go out to an MCP someday"*). Biologics coverage and surveillance are things he raised as ideas; parking them is our call.

**Critique like a seasoned expert.** *"Take on the persona of a very seasoned drug discovery research expert. What would they do to critique the output of this, and then iteratively kind of round off those."* → our review loop: every screen is put in front of a fresh reviewer playing that expert before we call it done.

## The number for the stage

AstraZeneca applied a five-question framework to every project: right target, right patient, right tissue, right safety, right commercial potential. Their candidate-to-phase-III completion rate went from 4 % in 2005–2010 to 19 % in 2012–2016 (Morgan et al., *Nat Rev Drug Discov* 2018, https://pubmed.ncbi.nlm.nih.gov/29348681/). A checklist a scientist actually runs, per candidate, more than quadrupled the rate. Elute puts that checklist on the card.

## The second track: OpenAlex

For the sponsor track that provides the OpenAlex dataset (name as heard: Volar Ridge; confirm before the deck), the framing is: OpenAlex is the main literature context of the appraisal, and the other sources are supporting context. Concretely, the literature step of the ledger pulls works and their citation graph from OpenAlex, and every paper cited in the exported discussion document carries its OpenAlex work id. It is a backend-stage addition, not a last-minute drop-in, and the PRD records it that way (§8).

## Audiences he named that we are not building for this weekend

We build for one user: the translational scientist who has to decide whether a candidate goes into preclinical or clinical testing. Henry named others; they are pitch context, not product scope.

- **Investors and diligence teams.** *"Oh, you hit it out of the park with any of these hedge funds... you mean we just know the drug doesn't work? We don't need math?"* Same appraisal, thinner document.
- **Small biotechs.** *"Innovation tends to happen in small biotechs much faster... they have to outsource these very generic contract research organizations."* Large companies would build this themselves.
- **NIH grant applicants and reviewers.** A two-sided use he sketched; out of scope.
- **Doctors, medical students, the general public.** He saw the pathway drawings as teaching material; out of scope.
- **Patients.** He called them *"the most delicate end-user population that you have to think about"*: *"Put in the hands of patients, they would kind of abuse this in ways they don't understand... They might see a bunch of stuff that says we don't know if this drug's going to work. I don't want to do the trial."* He also saw the upside: *"how do you help patients decide what trials to do?"* and *"for the patients, it's not time or money. You might save their life."* Excluding them this weekend is our decision, not his. The product carries no patient-facing surface and never reads as advice.

He also warned that the audience we chose is the hardest to sell to: *"Surprisingly, the company already has a way of doing this. So they're the least friendly audience if you ever want to create a startup around this."* We are building for them anyway because the judge is one of them and the job is real.

## Would he pay for it

His answer, useful on stage if asked: *"Paying for the tool is a different problem to solve in healthcare... ask, well, what do you use today to do this? And when they start complaining, or they're not really emotionally attached to their solution, then you know you could actually get them to pay for it."* And on Regeneron specifically: *"This is not necessarily something we would buy, but we would try and build internally. Because we also have proprietary information that fills in the blanks."*

## Lines we will not use

- Anything that reads as a recommendation to pursue or prescribe.
- "AI magic," "revolutionary," or a confidence number.
- Any sentence the tool writes about itself. The product shows; the pitch tells.
