# AI Teacher Design

## Purpose

AI Teacher is a web-first reading comprehension tutor for students who need help understanding school material. The app helps a student work through material in its original form, then gives targeted support when the student needs simpler wording, missing context, read-aloud help, or another explanation.

The app is designed for two users:

- Student, who works through assigned or uploaded material
- Parent, who can manage material, settings, progress, and AI routing

Both the student and the parent can sign in with the standard Login with Google flow, consistent with how Google sign-in works in other web apps. The parent can link to the student profile and review lesson history.

## Core Learning Flow

The student starts with the original material. The app breaks the material into chunks, but the original full text remains available.

For each chunk:

1. The student reads or listens to the original chunk.
2. The lesson screen shows where the student is, such as "Chunk 3 of 8", with completed, current, and remaining chunks visible. The current chunk is also visually emphasized inside the text itself with a calm highlight, soft border, or focused reading band so the student can immediately see what they are working on. Other chunks remain clickable/tappable so the student can go back to review a previous chunk or intentionally select a different chunk.
3. The student can select text and ask for guided help.
4. The student speaks a paraphrase in their own words.
5. The app transcribes the student's speech.
6. The AI scores the student's understanding using meaning, key details, and context.
7. If the score meets the chunk mastery threshold, the student can continue.
8. If the score is below threshold, the student sees two retry choices: Try Again or Explain Again.
9. Explain Again gives a gap-aware explanation focused on what the student's paraphrase missed, then asks the student to try again.

After all chunks meet the chunk mastery threshold, the student completes a whole-text review:

1. The student reviews the full material.
2. The student speaks a full paraphrase or summary of the entire text.
3. The app scores the final summary for main idea, important points throughout the text, key context, connections between chunks, and why the material matters.
4. If the score meets the final summary mastery threshold, the material is marked complete.
5. If the score is below threshold, the student can try again or receive an explanation focused on missing connections and important points.

Material is complete only when every required chunk meets the chunk threshold and the final whole-text summary meets the final summary threshold.

## Mastery Settings

The parent can configure mastery thresholds from the start:

- Chunk mastery threshold
- Final summary mastery threshold

The app should default to sensible values, such as 90 percent for both, but the parent can adjust them after seeing how the student responds. The app stores actual score history so the parent can decide what threshold works best.

## Reading Supports

The student can use reading supports without leaving the lesson screen.

Supported actions:

- Simplify selected text
- Simplify the current chunk
- Simplify the full material
- Explain context
- Define vocabulary
- Explain why the selected text matters
- Read aloud

Simplification uses both plain labels and approximate reading levels:

- Very Simple, about 3rd grade
- Simple, about 5th grade
- Middle School, about 7th to 8th grade
- Original

The student can change levels while reading until the material makes sense. The app should connect simplified versions back to the original wording so the student learns the assigned material rather than only a replacement summary.

Text selection should feel intuitive on both touch and pointer devices. When the student double-taps or double-clicks a word, the app selects that word and shows left and right selection handles/arrows. The student can drag or tap those handles to expand the selection across multiple words, sentences, or a full passage. Selected text opens an accessible help popover with guided actions:

- Simplify
- Explain Context
- Define
- Why It Matters
- Read Aloud

The popover should not be tiny or hover-only. It must be usable with touch, keyboard, and mouse, and it should offer a larger view for longer explanations.

## Audio

Read-aloud is a first-class feature. The app should support reading everything on the lesson screen:

- original passage
- selected text
- simplified text
- explanations
- instructions
- score feedback
- retry prompts

Audio strategy:

- Browser text-to-speech is the default for fast read-aloud.
- OpenAI streaming text-to-speech can be used for higher-quality generated audio.
- Generated audio should be cached for repeated lesson material.
- Long material should be broken into smaller audio segments so playback can begin quickly.
- The app should disclose when a voice is AI-generated.

## Guided Help, Not Open Chat

The student should not need to use an open-ended chat interface in version one. The app provides guided prompts instead:

- Simplify
- Explain Context
- Define
- Why It Matters
- Read Aloud

This keeps the lesson focused and reduces the chance of the AI wandering away from the assignment. Try Again is not a general help action. It appears only after the student scores below the configured threshold for a chunk or for the final whole-text summary. After choosing Try Again, the student may still use Simplify, Explain Context, Define, Why It Matters, or Read Aloud before recording another paraphrase.

## Parent Experience

The parent view supports:

- standard Login with Google sign-in
- linking a student account/profile
- uploading or pasting material
- reviewing extracted text
- viewing all uploaded material
- viewing chunk scores
- viewing final summary scores
- seeing completion status
- seeing attempt history
- setting chunk and final summary thresholds
- managing reading level preferences
- managing audio preferences
- managing AI routing preferences
- reviewing recurring comprehension patterns

Material history should show what the student worked on, when the student worked on it, how many attempts were needed, which chunks were difficult, and whether the material is complete.

## Input Types

The app should support these material inputs:

- Copy and paste text
- Upload files
- Take or upload a photo

Copy and paste can be the simplest first input to implement, but the product design includes all three. Uploaded files and photos require text extraction and parent review before the lesson begins.

## Architecture

The app is a React web app talking to a REST API backend.

The frontend handles:

- lesson reading interface
- chunk progress display
- current-chunk visual focus, such as soft highlighting, a subtle border, or a reading band
- clickable/tappable chunks for reviewing or selecting another chunk
- intuitive selected-text popovers with double-tap word selection and expandable left/right handles
- voice recording controls
- audio playback controls
- student flow
- parent dashboard
- settings screens

The frontend never calls AI provider APIs directly.

The backend handles:

- Google authentication and sessions
- parent and student accounts
- linked parent/student relationship
- material storage
- text extraction
- chunking
- attempts and scoring
- completion status
- learning profile updates
- speech transcription
- text-to-speech orchestration
- AI routing
- provider API keys

## AI Routing

The backend should include a capability router. The parent can choose which provider handles each AI capability.

Initial provider targets:

- DeepSeek for most teaching, simplification, explanation, and scoring tasks
- OpenAI for capabilities that DeepSeek does not support well, such as speech transcription, high-quality streaming text-to-speech, image/photo extraction, and fallback handling
- Browser TTS for fast local read-aloud

Configurable routing capabilities:

- Simplify text
- Explain context
- Define vocabulary
- Explain why it matters
- Score chunk paraphrase
- Explain again after low score
- Score final summary
- Speech transcription
- High-quality text-to-speech
- Photo/image text extraction
- Fallback provider

The rest of the app calls one internal AI teaching service. That service reads the routing preferences and dispatches each request to the selected provider.

The settings UI should warn the parent if a selected provider does not support a capability.

## Learning Profile

The app should maintain a learning profile for each student.

The profile tracks:

- preferred simplification level
- vocabulary the student needed help with
- recurring comprehension gaps
- subject or topic areas that need extra context
- whether audio improves success
- chunk length that works best
- paraphrase score trends
- attempts per chunk
- final summary performance

The profile should support personalization while remaining visible and understandable to the parent.

## Scoring

Scoring measures understanding, not word matching.

Chunk paraphrases are scored on:

- main idea
- key details
- important people, events, or terms
- cause and effect
- context
- why the chunk matters
- absence of major misunderstandings

Final summaries are scored on:

- whole-text main idea
- important points throughout the text
- connections between chunks
- key context
- why the material matters
- accurate explanation in the student's own words

The app should store a rubric breakdown with each attempt so feedback can be specific and parent review can be meaningful.

## Error Handling

The app should be gentle when something fails.

- If transcription fails, the student can record again.
- If scoring fails, the attempt does not count against her.
- If DeepSeek is unavailable, the router can use the configured fallback provider.
- If generated audio fails, the app can fall back to browser TTS.
- If photo or file extraction fails, the parent can correct the extracted text manually.
- If the AI response is malformed, the backend should retry or return a clear, non-punitive message.

## Testing Focus

The app needs technical tests and learning-experience tests.

Technical testing should cover:

- auth and linked profiles
- material creation
- chunking
- attempt submission
- scoring persistence
- threshold completion logic
- final summary completion logic
- AI routing preferences
- fallback behavior
- audio mode selection

Learning-experience testing should answer:

- Does the student always know what to do next?
- Does the student know which chunk they are on?
- Is the current chunk visually obvious without making the page feel distracting?
- Can the student tap/click another chunk to review it without losing their place?
- Does read-aloud start quickly?
- Are simplifications actually easier?
- Does Explain Again address the missed idea?
- Are scores consistent enough to trust?
- Can the parent understand why a material is incomplete?




