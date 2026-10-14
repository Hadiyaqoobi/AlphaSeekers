# Dari translation needed

**475 strings** in the app are still showing **English** to Dari readers.
The keys exist in `messages/fa.json`, so nothing errors — the English text was left in place
when these features shipped. The sections are ordered by who sees them: what students see first
(the class join page, the live class page, sign-in), then teachers, then staff screens.

This file is generated from `src/i18n/untranslated-baseline.json` by `node scripts/gen-translation-needed.mjs .`.
Regenerate it rather than editing the list by hand, so it never drifts from what the app shows.

## Who fills this in

A native Dari speaker on the team. **Please do not run this through Google Translate or an AI**
— machine-translated Dari has gone out on this platform before and had to be pulled. If a string
is awkward to translate, leave it blank and say so; blank is better than wrong.

## How to fill it in

Write the Dari next to each line. Anything in curly braces — `{count}`, `{name}`, `{date}` —
is a value the app substitutes at runtime. **Keep those exactly as they are**, including the braces;
you can move them to wherever they belong in the Dari sentence, but do not translate or rename them.

Send the finished file back and we will load it in. A test blocks any *new* English-only
string from being added, so this list can only get shorter.

---

## Outside the message files — 3 strings hard-coded in `public/sw.js`

These live in the service worker's offline page, which is a static file and
cannot read `messages/fa.json`. Send the Dari and we paste it in directly (and
set `lang="fa" dir="rtl"` on that page at the same time).

- **English:** "No internet connection"
  **Dari:** 

- **English:** "This page could not load. Check your connection and try again."
  **Dari:** 

- **English:** "Try again"
  **Dari:**

---

## `classJoin`  ·  32 strings

- **English:** "Join this class"
  **Dari:** 
  <sub>`classJoin.eyebrow`</sub>

- **English:** "Teacher"
  **Dari:** 
  <sub>`classJoin.teacher`</sub>

- **English:** "Subject"
  **Dari:** 
  <sub>`classJoin.subject`</sub>

- **English:** "When"
  **Dari:** 
  <sub>`classJoin.when`</sub>

- **English:** "Seats left"
  **Dari:** 
  <sub>`classJoin.seatsLeft`</sub>

- **English:** "Register for this class"
  **Dari:** 
  <sub>`classJoin.formTitle`</sub>

- **English:** "Fill this in once. It creates your AlphaSeekers account and puts you in the class — there is nothing else to sign up for."
  **Dari:** 
  <sub>`classJoin.formSubtitle`</sub>

- **English:** "Your full name"
  **Dari:** 
  <sub>`classJoin.nameLabel`</sub>

- **English:** "Your email address"
  **Dari:** 
  <sub>`classJoin.emailLabel`</sub>

- **English:** "You will use this email to sign in later."
  **Dari:** 
  <sub>`classJoin.emailHint`</sub>

- **English:** "Choose a password"
  **Dari:** 
  <sub>`classJoin.passwordLabel`</sub>

- **English:** "At least 8 characters, with one letter and one number. You will use this to sign in."
  **Dari:** 
  <sub>`classJoin.passwordHint`</sub>

- **English:** "Show"
  **Dari:** 
  <sub>`classJoin.show`</sub>

- **English:** "Hide"
  **Dari:** 
  <sub>`classJoin.hide`</sub>

- **English:** "Show password"
  **Dari:** 
  <sub>`classJoin.showPassword`</sub>

- **English:** "Hide password"
  **Dari:** 
  <sub>`classJoin.hidePassword`</sub>

- **English:** "Join this class"
  **Dari:** 
  <sub>`classJoin.submit`</sub>

- **English:** "Joining..."
  **Dari:** 
  <sub>`classJoin.joining`</sub>

- **English:** "Could not join this class. Please try again."
  **Dari:** 
  <sub>`classJoin.failed`</sub>

- **English:** "We could not reach AlphaSeekers. Check your internet connection and try again."
  **Dari:** 
  <sub>`classJoin.networkError`</sub>

- **English:** "This class is full. Please check the other classes that are open."
  **Dari:** 
  <sub>`classJoin.classFull`</sub>

- **English:** "Already have an account?"
  **Dari:** 
  <sub>`classJoin.alreadyHaveAccount`</sub>

- **English:** "Sign in"
  **Dari:** 
  <sub>`classJoin.signInInstead`</sub>

- **English:** "Please enter your full name."
  **Dari:** 
  <sub>`classJoin.errors.name`</sub>

- **English:** "Your password needs at least 8 characters, with at least one letter and one number."
  **Dari:** 
  <sub>`classJoin.errors.password`</sub>

- **English:** "Too many attempts. Please wait a few minutes and try again."
  **Dari:** 
  <sub>`classJoin.errors.rateLimited`</sub>

- **English:** "This class could not be found."
  **Dari:** 
  <sub>`classJoin.errors.notFound`</sub>

- **English:** "This class is not open for registration."
  **Dari:** 
  <sub>`classJoin.errors.closed`</sub>

- **English:** "Registration for this class has closed."
  **Dari:** 
  <sub>`classJoin.errors.registrationClosed`</sub>

- **English:** "An account already uses this email. Enter that account's password to join, or sign in first."
  **Dari:** 
  <sub>`classJoin.errors.wrongPassword`</sub>

- **English:** "This account has been turned off. Please ask your teacher or the AlphaSeekers team."
  **Dari:** 
  <sub>`classJoin.errors.deactivated`</sub>

- **English:** "This email belongs to a teacher or admin account. Please sign in instead."
  **Dari:** 
  <sub>`classJoin.errors.notAStudent`</sub>


## `enroll`  ·  5 strings

- **English:** "Join this class"
  **Dari:** 
  <sub>`enroll.requestToJoin`</sub>

- **English:** "You have joined this class."
  **Dari:** 
  <sub>`enroll.requestSent`</sub>

- **English:** "Registration for this class has closed."
  **Dari:** 
  <sub>`enroll.registrationClosed`</sub>

- **English:** "This class is full."
  **Dari:** 
  <sub>`enroll.classFull`</sub>

- **English:** "Your request for this class was not approved."
  **Dari:** 
  <sub>`enroll.rejected`</sub>


## `liveSession`  ·  84 strings

- **English:** "{className} live session"
  **Dari:** 
  <sub>`liveSession.metaTitle`</sub>

- **English:** "Session"
  **Dari:** 
  <sub>`liveSession.metaFallback`</sub>

- **English:** "Session cancelled"
  **Dari:** 
  <sub>`liveSession.cancelledTitle`</sub>

- **English:** "Cannot open this session"
  **Dari:** 
  <sub>`liveSession.cannotOpenTitle`</sub>

- **English:** "This session was cancelled."
  **Dari:** 
  <sub>`liveSession.reasons.cancelled`</sub>

- **English:** "You are not enrolled in this class."
  **Dari:** 
  <sub>`liveSession.reasons.notEnrolled`</sub>

- **English:** "This session has not started yet. Come back closer to the start time."
  **Dari:** 
  <sub>`liveSession.reasons.notStarted`</sub>

- **English:** "This live session has ended. You can still view the summary and recording."
  **Dari:** 
  <sub>`liveSession.reasons.ended`</sub>

- **English:** "You cannot open this session right now."
  **Dari:** 
  <sub>`liveSession.reasons.generic`</sub>

- **English:** "Language class"
  **Dari:** 
  <sub>`liveSession.languageClass`</sub>

- **English:** "Live session"
  **Dari:** 
  <sub>`liveSession.liveSession`</sub>

- **English:** "With {name}"
  **Dari:** 
  <sub>`liveSession.withTeacher`</sub>

- **English:** "Starts in {minutes} min"
  **Dari:** 
  <sub>`liveSession.startsIn`</sub>

- **English:** "Started {minutes} min ago"
  **Dari:** 
  <sub>`liveSession.startedAgo`</sub>

- **English:** "Starting now"
  **Dari:** 
  <sub>`liveSession.startingNow`</sub>

- **English:** "Session ended"
  **Dari:** 
  <sub>`liveSession.ended`</sub>

- **English:** "Join Google Meet"
  **Dari:** 
  <sub>`liveSession.joinMeet`</sub>

- **English:** "Connected — Meet is open in another tab"
  **Dari:** 
  <sub>`liveSession.connected`</sub>

- **English:** "Switch back to the Meet tab anytime. Your notes save here."
  **Dari:** 
  <sub>`liveSession.switchBack`</sub>

- **English:** "Re-open Meet"
  **Dari:** 
  <sub>`liveSession.reopenMeet`</sub>

- **English:** "Meet link not available yet. Check back closer to start time."
  **Dari:** 
  <sub>`liveSession.noMeetLink`</sub>

- **English:** "Today's materials"
  **Dari:** 
  <sub>`liveSession.materials`</sub>

- **English:** "After class — teacher tools"
  **Dari:** 
  <sub>`liveSession.teacherTools`</sub>

- **English:** "Generating..."
  **Dari:** 
  <sub>`liveSession.generating`</sub>

- **English:** "Generate summary"
  **Dari:** 
  <sub>`liveSession.generateSummary`</sub>

- **English:** "Regenerate summary"
  **Dari:** 
  <sub>`liveSession.regenerateSummary`</sub>

- **English:** "Create quiz"
  **Dari:** 
  <sub>`liveSession.createQuiz`</sub>

- **English:** "Regenerate quiz"
  **Dari:** 
  <sub>`liveSession.regenerateQuiz`</sub>

- **English:** "Recording & homework setup"
  **Dari:** 
  <sub>`liveSession.recordingSetup`</sub>

- **English:** "Could not create the summary. Please try again."
  **Dari:** 
  <sub>`liveSession.summaryFailed`</sub>

- **English:** "Could not create the quiz. Please try again."
  **Dari:** 
  <sub>`liveSession.quizFailed`</sub>

- **English:** "Attendance"
  **Dari:** 
  <sub>`liveSession.attendance`</sub>

- **English:** "{verified} verified · {joined} joined / {total}"
  **Dari:** 
  <sub>`liveSession.rosterCounts`</sub>

- **English:** "Class summary"
  **Dari:** 
  <sub>`liveSession.summary`</sub>

- **English:** "My notes"
  **Dari:** 
  <sub>`liveSession.myNotes`</sub>

- **English:** "Quick AI"
  **Dari:** 
  <sub>`liveSession.quickAi`</sub>

- **English:** "Key vocabulary"
  **Dari:** 
  <sub>`liveSession.vocabulary`</sub>

- **English:** "Attendance marked at {time}"
  **Dari:** 
  <sub>`liveSession.attendanceMarkedAt`</sub>

- **English:** "Please select an image."
  **Dari:** 
  <sub>`liveSession.homework.selectImage`</sub>

- **English:** "The image must be smaller than 5 MB."
  **Dari:** 
  <sub>`liveSession.homework.imageTooLarge`</sub>

- **English:** "Could not upload the photo. Please try again."
  **Dari:** 
  <sub>`liveSession.homework.uploadFailed`</sub>

- **English:** "Add some text or upload a photo."
  **Dari:** 
  <sub>`liveSession.homework.needContent`</sub>

- **English:** "Could not submit your homework. Please try again."
  **Dari:** 
  <sub>`liveSession.homework.submitFailed`</sub>

- **English:** "Submitted"
  **Dari:** 
  <sub>`liveSession.homework.submitted`</sub>

- **English:** "Submitted {time}"
  **Dari:** 
  <sub>`liveSession.homework.submittedAt`</sub>

- **English:** "AI review"
  **Dari:** 
  <sub>`liveSession.homework.aiReview`</sub>

- **English:** "Teacher feedback"
  **Dari:** 
  <sub>`liveSession.homework.teacherFeedback`</sub>

- **English:** "Teacher feedback ({grade})"
  **Dari:** 
  <sub>`liveSession.homework.teacherFeedbackWithGrade`</sub>

- **English:** "Teacher review pending"
  **Dari:** 
  <sub>`liveSession.homework.reviewPending`</sub>

- **English:** "Due: {date}"
  **Dari:** 
  <sub>`liveSession.homework.due`</sub>

- **English:** "Type your answers here..."
  **Dari:** 
  <sub>`liveSession.homework.answerPlaceholder`</sub>

- **English:** "Photo of your homework"
  **Dari:** 
  <sub>`liveSession.homework.photoAlt`</sub>

- **English:** "Remove photo"
  **Dari:** 
  <sub>`liveSession.homework.removePhoto`</sub>

- **English:** "Uploading..."
  **Dari:** 
  <sub>`liveSession.homework.uploading`</sub>

- **English:** "Upload a photo of your work"
  **Dari:** 
  <sub>`liveSession.homework.uploadPhoto`</sub>

- **English:** "Submitting..."
  **Dari:** 
  <sub>`liveSession.homework.submitting`</sub>

- **English:** "Submit homework"
  **Dari:** 
  <sub>`liveSession.homework.submit`</sub>

- **English:** "Post-class quiz"
  **Dari:** 
  <sub>`liveSession.quiz.title`</sub>

- **English:** "{count} questions · Test your understanding of today's lesson."
  **Dari:** 
  <sub>`liveSession.quiz.intro`</sub>

- **English:** "Start quiz"
  **Dari:** 
  <sub>`liveSession.quiz.start`</sub>

- **English:** "{correct} / {total} correct"
  **Dari:** 
  <sub>`liveSession.quiz.score`</sub>

- **English:** "Great work — you really understood today's lesson!"
  **Dari:** 
  <sub>`liveSession.quiz.great`</sub>

- **English:** "Good progress. Review the topics you missed."
  **Dari:** 
  <sub>`liveSession.quiz.good`</sub>

- **English:** "Don't worry. Review the materials and try again."
  **Dari:** 
  <sub>`liveSession.quiz.keepGoing`</sub>

- **English:** "Question {current} of {total}"
  **Dari:** 
  <sub>`liveSession.quiz.progress`</sub>

- **English:** "Type your answer..."
  **Dari:** 
  <sub>`liveSession.quiz.answerPlaceholder`</sub>

- **English:** "The correct answer is:"
  **Dari:** 
  <sub>`liveSession.quiz.correctAnswerIs`</sub>

- **English:** "Correct!"
  **Dari:** 
  <sub>`liveSession.quiz.correct`</sub>

- **English:** "Check answer"
  **Dari:** 
  <sub>`liveSession.quiz.check`</sub>

- **English:** "Next question"
  **Dari:** 
  <sub>`liveSession.quiz.next`</sub>

- **English:** "See results"
  **Dari:** 
  <sub>`liveSession.quiz.results`</sub>

- **English:** "My notes"
  **Dari:** 
  <sub>`liveSession.notes.label`</sub>

- **English:** "Take notes during class. They save automatically and you can read them later..."
  **Dari:** 
  <sub>`liveSession.notes.placeholder`</sub>

- **English:** "Saving..."
  **Dari:** 
  <sub>`liveSession.notes.saving`</sub>

- **English:** "Saved {time}"
  **Dari:** 
  <sub>`liveSession.notes.savedAt`</sub>

- **English:** "Not saved yet"
  **Dari:** 
  <sub>`liveSession.notes.notSaved`</sub>

- **English:** "Save now"
  **Dari:** 
  <sub>`liveSession.notes.saveNow`</sub>

- **English:** "Summary draft — check and edit it before publishing"
  **Dari:** 
  <sub>`liveSession.draftTitle`</sub>

- **English:** "Students do not see this summary until you publish it."
  **Dari:** 
  <sub>`liveSession.draftNote`</sub>

- **English:** "The summary must be at least 20 characters before it can be published."
  **Dari:** 
  <sub>`liveSession.draftTooShort`</sub>

- **English:** "Publish to class"
  **Dari:** 
  <sub>`liveSession.publishSummary`</sub>

- **English:** "Publishing..."
  **Dari:** 
  <sub>`liveSession.publishing`</sub>

- **English:** "Could not publish the summary. Please try again."
  **Dari:** 
  <sub>`liveSession.publishFailed`</sub>

- **English:** "Published. Students in this class can now see the summary."
  **Dari:** 
  <sub>`liveSession.summaryPublished`</sub>


## `login`  ·  8 strings

- **English:** "Continue with Google"
  **Dari:** 
  <sub>`login.continueWithGoogle`</sub>

- **English:** "or use your email"
  **Dari:** 
  <sub>`login.orUseEmail`</sub>

- **English:** "Too many sign-in attempts. Please wait about 15 minutes and try again — your account is not locked."
  **Dari:** 
  <sub>`login.tooManyAttempts`</sub>

- **English:** "This account has been turned off. Please ask your teacher or the AlphaSeekers team."
  **Dari:** 
  <sub>`login.deactivated`</sub>

- **English:** "Google has not verified that email address, so we cannot sign you in with it. Please use your email and password instead."
  **Dari:** 
  <sub>`login.googleEmailUnverified`</sub>

- **English:** "Google did not share an email address with us. Please use your email and password instead."
  **Dari:** 
  <sub>`login.googleNoEmail`</sub>

- **English:** "Something went wrong signing in with Google. Please try again, or use your email and password."
  **Dari:** 
  <sub>`login.googleFailed`</sub>

- **English:** "Your account is ready. Sign in with the email and password you just chose."
  **Dari:** 
  <sub>`login.accountReady`</sub>


## `register`  ·  5 strings

- **English:** "Create account"
  **Dari:** 
  <sub>`register.eyebrow`</sub>

- **English:** "Create your account"
  **Dari:** 
  <sub>`register.title`</sub>

- **English:** "Sign up and start straight away. Joining a class is approved separately by the team."
  **Dari:** 
  <sub>`register.subtitle`</sub>

- **English:** "Create account"
  **Dari:** 
  <sub>`register.submit`</sub>

- **English:** "Your account is created as a student. Tell the team you want to teach and an admin can upgrade it."
  **Dari:** 
  <sub>`register.teacherRequestNote`</sub>


## `forgotPassword`  ·  7 strings

- **English:** "Forgot your password?"
  **Dari:** 
  <sub>`forgotPassword.title`</sub>

- **English:** "Enter your email and we'll send you a link to reset it."
  **Dari:** 
  <sub>`forgotPassword.subtitle`</sub>

- **English:** "Send reset link"
  **Dari:** 
  <sub>`forgotPassword.submit`</sub>

- **English:** "Sending…"
  **Dari:** 
  <sub>`forgotPassword.sending`</sub>

- **English:** "Back to sign in"
  **Dari:** 
  <sub>`forgotPassword.backToLogin`</sub>

- **English:** "Check your email"
  **Dari:** 
  <sub>`forgotPassword.sentTitle`</sub>

- **English:** "If an account exists for that email, we've sent a link to reset your password. It expires in 1 hour."
  **Dari:** 
  <sub>`forgotPassword.sentBody`</sub>


## `resetPassword`  ·  15 strings

- **English:** "Set a new password"
  **Dari:** 
  <sub>`resetPassword.title`</sub>

- **English:** "Choose a new password for your account."
  **Dari:** 
  <sub>`resetPassword.subtitle`</sub>

- **English:** "New password"
  **Dari:** 
  <sub>`resetPassword.newPassword`</sub>

- **English:** "Confirm password"
  **Dari:** 
  <sub>`resetPassword.confirmPassword`</sub>

- **English:** "Reset password"
  **Dari:** 
  <sub>`resetPassword.submit`</sub>

- **English:** "Resetting…"
  **Dari:** 
  <sub>`resetPassword.resetting`</sub>

- **English:** "Password updated"
  **Dari:** 
  <sub>`resetPassword.successTitle`</sub>

- **English:** "Your password has been changed. You can now sign in with it."
  **Dari:** 
  <sub>`resetPassword.successBody`</sub>

- **English:** "Go to sign in"
  **Dari:** 
  <sub>`resetPassword.goToLogin`</sub>

- **English:** "This reset link is invalid or has expired. Please request a new one."
  **Dari:** 
  <sub>`resetPassword.invalidToken`</sub>

- **English:** "Request a new link"
  **Dari:** 
  <sub>`resetPassword.requestNew`</sub>

- **English:** "Passwords don't match."
  **Dari:** 
  <sub>`resetPassword.mismatch`</sub>

- **English:** "Password must be at least 8 characters and include a letter and a number."
  **Dari:** 
  <sub>`resetPassword.weak`</sub>

- **English:** "Too many attempts. Please wait a few minutes and try again."
  **Dari:** 
  <sub>`resetPassword.rateLimited`</sub>

- **English:** "We could not reset your password. Check your internet connection and try again."
  **Dari:** 
  <sub>`resetPassword.failed`</sub>


## `classDetail`  ·  11 strings

- **English:** "Remove"
  **Dari:** 
  <sub>`classDetail.remove`</sub>

- **English:** "Yes, remove"
  **Dari:** 
  <sub>`classDetail.confirmRemove`</sub>

- **English:** "Removing..."
  **Dari:** 
  <sub>`classDetail.removing`</sub>

- **English:** "Cancel"
  **Dari:** 
  <sub>`classDetail.cancel`</sub>

- **English:** "Could not remove this student. Please try again."
  **Dari:** 
  <sub>`classDetail.removeFailed`</sub>

- **English:** "Remove {name} from this class"
  **Dari:** 
  <sub>`classDetail.removeStudentAria`</sub>

- **English:** "Registration link — share this with students"
  **Dari:** 
  <sub>`classDetail.shareLinkLabel`</sub>

- **English:** "Anyone can open this without an account. It creates their account and puts them in this class."
  **Dari:** 
  <sub>`classDetail.shareLinkHint`</sub>

- **English:** "Copy"
  **Dari:** 
  <sub>`classDetail.copy`</sub>

- **English:** "Copied"
  **Dari:** 
  <sub>`classDetail.copied`</sub>

- **English:** "Could not copy automatically. Select the link above and copy it."
  **Dari:** 
  <sub>`classDetail.copyFailed`</sub>


## `classes`  ·  2 strings

- **English:** "Registration closes {date}"
  **Dari:** 
  <sub>`classes.registrationCloses`</sub>

- **English:** "Registration closed"
  **Dari:** 
  <sub>`classes.registrationClosed`</sub>


## `dashboard`  ·  8 strings

- **English:** "Support requests"
  **Dari:** 
  <sub>`dashboard.quickActions.support`</sub>

- **English:** "{count} support request(s) waiting"
  **Dari:** 
  <sub>`dashboard.support.waiting`</sub>

- **English:** "{count} urgent"
  **Dari:** 
  <sub>`dashboard.support.urgent`</sub>

- **English:** "Review"
  **Dari:** 
  <sub>`dashboard.support.review`</sub>

- **English:** "{count} student(s) waiting to join a class"
  **Dari:** 
  <sub>`dashboard.pendingEnrollments.waiting`</sub>

- **English:** "{count} waiting"
  **Dari:** 
  <sub>`dashboard.pendingEnrollments.count`</sub>

- **English:** "oldest since {date}"
  **Dari:** 
  <sub>`dashboard.pendingEnrollments.since`</sub>

- **English:** "Review"
  **Dari:** 
  <sub>`dashboard.pendingEnrollments.review`</sub>


## `nav`  ·  9 strings

- **English:** ""
  **Dari:** 
  <sub>`nav.networkBadge`</sub>

- **English:** "Site Settings"
  **Dari:** 
  <sub>`nav.siteSettings`</sub>

- **English:** "Contact us"
  **Dari:** 
  <sub>`nav.contact`</sub>

- **English:** "Support"
  **Dari:** 
  <sub>`nav.support`</sub>

- **English:** "Class setup"
  **Dari:** 
  <sub>`nav.setup`</sub>

- **English:** "Story moderation"
  **Dari:** 
  <sub>`nav.storyModeration`</sub>

- **English:** "Open menu"
  **Dari:** 
  <sub>`nav.openMenu`</sub>

- **English:** "Close menu"
  **Dari:** 
  <sub>`nav.closeMenu`</sub>

- **English:** "Skip to content"
  **Dari:** 
  <sub>`nav.skipToContent`</sub>


## `profile`  ·  8 strings

- **English:** "Current password is incorrect."
  **Dari:** 
  <sub>`profile.password.errors.wrongCurrent`</sub>

- **English:** "New password must be different from your current password."
  **Dari:** 
  <sub>`profile.password.errors.sameAsCurrent`</sub>

- **English:** "Your password needs at least 8 characters, with at least one letter and one number."
  **Dari:** 
  <sub>`profile.password.errors.weak`</sub>

- **English:** "Too many attempts. Please wait a few minutes and try again."
  **Dari:** 
  <sub>`profile.password.errors.rateLimited`</sub>

- **English:** "At least 8 characters, with at least one letter and one number."
  **Dari:** 
  <sub>`profile.password.rule`</sub>

- **English:** "Integrations"
  **Dari:** 
  <sub>`profile.integrations`</sub>

- **English:** "Set a new password"
  **Dari:** 
  <sub>`profile.changePassword.title`</sub>

- **English:** "Choose a strong password you have not used elsewhere. Once saved, the temporary-password reminder disappears."
  **Dari:** 
  <sub>`profile.changePassword.subtitle`</sub>


## `ai`  ·  3 strings

- **English:** "You're asking great questions! Give me a moment to catch up — try again in a few seconds."
  **Dari:** 
  <sub>`ai.errorBusy`</sub>

- **English:** "The study assistant isn't available right now. Please try again later or ask your teacher."
  **Dari:** 
  <sub>`ai.errorUnavailable`</sub>

- **English:** "I couldn't get an answer right now. Please try again."
  **Dari:** 
  <sub>`ai.errorFailed`</sub>


## `landing`  ·  22 strings

- **English:** "Open now"
  **Dari:** 
  <sub>`landing.nowOpen.kicker`</sub>

- **English:** "Start learning this month"
  **Dari:** 
  <sub>`landing.nowOpen.title`</sub>

- **English:** "Free classes and sessions currently open to everyone. New ones appear here as soon as they are announced."
  **Dari:** 
  <sub>`landing.nowOpen.subtitle`</sub>

- **English:** "Register free"
  **Dari:** 
  <sub>`landing.nowOpen.cta`</sub>

- **English:** "Free"
  **Dari:** 
  <sub>`landing.nowOpen.free`</sub>

- **English:** "Instructor"
  **Dari:** 
  <sub>`landing.nowOpen.instructor`</sub>

- **English:** "When"
  **Dari:** 
  <sub>`landing.nowOpen.when`</sub>

- **English:** "Seats left"
  **Dari:** 
  <sub>`landing.nowOpen.seats`</sub>

- **English:** "Join this class"
  **Dari:** 
  <sub>`landing.nowOpen.enrol`</sub>

- **English:** "Webinar"
  **Dari:** 
  <sub>`landing.nowOpen.webinar`</sub>

- **English:** "Reserve a place"
  **Dari:** 
  <sub>`landing.nowOpen.reserve`</sub>

- **English:** "Opportunity"
  **Dari:** 
  <sub>`landing.nowOpen.opportunity`</sub>

- **English:** "Closes"
  **Dari:** 
  <sub>`landing.nowOpen.closes`</sub>

- **English:** "Read more"
  **Dari:** 
  <sub>`landing.nowOpen.readMore`</sub>

- **English:** "Register for this course"
  **Dari:** 
  <sub>`landing.nowOpen.register`</sub>

- **English:** "English A2"
  **Dari:** 
  <sub>`landing.howItWorks.mockup.mockClassNames.0`</sub>

- **English:** "Graphic Design"
  **Dari:** 
  <sub>`landing.howItWorks.mockup.mockClassNames.1`</sub>

- **English:** "Career Skills"
  **Dari:** 
  <sub>`landing.howItWorks.mockup.mockClassNames.2`</sub>

- **English:** "Tue 6:00 PM"
  **Dari:** 
  <sub>`landing.howItWorks.mockup.mockTimes.0`</sub>

- **English:** "Wed 4:00 PM"
  **Dari:** 
  <sub>`landing.howItWorks.mockup.mockTimes.1`</sub>

- **English:** "Thu 5:30 PM"
  **Dari:** 
  <sub>`landing.howItWorks.mockup.mockTimes.2`</sub>

- **English:** "Contact us"
  **Dari:** 
  <sub>`landing.footer.contact`</sub>


## `contact`  ·  13 strings

- **English:** "Get in touch"
  **Dari:** 
  <sub>`contact.kicker`</sub>

- **English:** "Contact AlphaSeekers"
  **Dari:** 
  <sub>`contact.title`</sub>

- **English:** "Questions about our classes, volunteering, or partnering with us? Reach us on any of these channels."
  **Dari:** 
  <sub>`contact.subtitle`</sub>

- **English:** "Email"
  **Dari:** 
  <sub>`contact.email`</sub>

- **English:** "Join our WhatsApp channel"
  **Dari:** 
  <sub>`contact.whatsappValue`</sub>

- **English:** "Follow us on Facebook"
  **Dari:** 
  <sub>`contact.facebookValue`</sub>

- **English:** "Follow us on Instagram"
  **Dari:** 
  <sub>`contact.instagramValue`</sub>

- **English:** "Watch on YouTube"
  **Dari:** 
  <sub>`contact.youtubeValue`</sub>

- **English:** "Connect on LinkedIn"
  **Dari:** 
  <sub>`contact.linkedinValue`</sub>

- **English:** "Join us on Telegram"
  **Dari:** 
  <sub>`contact.telegramValue`</sub>

- **English:** "Follow us on X"
  **Dari:** 
  <sub>`contact.twitterValue`</sub>

- **English:** "We read every message and usually reply within a few days."
  **Dari:** 
  <sub>`contact.responseNote`</sub>

- **English:** "Contact details have not been published yet. Please check back soon."
  **Dari:** 
  <sub>`contact.empty`</sub>


## `attendance`  ·  13 strings

- **English:** "Verified (joined + code)"
  **Dari:** 
  <sub>`attendance.legend.verified`</sub>

- **English:** "Joined only (no code)"
  **Dari:** 
  <sub>`attendance.legend.joinedOnly`</sub>

- **English:** "Absent"
  **Dari:** 
  <sub>`attendance.legend.absent`</sub>

- **English:** "Could not save this attendance mark. It has been put back — please try again."
  **Dari:** 
  <sub>`attendance.saveFailed`</sub>

- **English:** "{verified} verified · {joined} / {total} joined"
  **Dari:** 
  <sub>`attendance.verifiedJoinedCount`</sub>

- **English:** "Status"
  **Dari:** 
  <sub>`attendance.status`</sub>

- **English:** "Manual"
  **Dari:** 
  <sub>`attendance.manual`</sub>

- **English:** "Mark {name} as absent"
  **Dari:** 
  <sub>`attendance.markAbsent`</sub>

- **English:** "Mark {name} as present"
  **Dari:** 
  <sub>`attendance.markPresent`</sub>

- **English:** "Joined"
  **Dari:** 
  <sub>`attendance.joinedColumn`</sub>

- **English:** "Join rate"
  **Dari:** 
  <sub>`attendance.joinRate`</sub>

- **English:** "Verified"
  **Dari:** 
  <sub>`attendance.verifiedColumn`</sub>

- **English:** "Verify rate"
  **Dari:** 
  <sub>`attendance.verifyRate`</sub>


## `classLifecycle`  ·  67 strings

- **English:** "Post a class"
  **Dari:** 
  <sub>`classLifecycle.formTitle`</sub>

- **English:** "Fill in what, who and when. At the end you get one link to send to students on WhatsApp."
  **Dari:** 
  <sub>`classLifecycle.formSubtitle`</sub>

- **English:** "What"
  **Dari:** 
  <sub>`classLifecycle.sectionWhat`</sub>

- **English:** "Who teaches"
  **Dari:** 
  <sub>`classLifecycle.sectionWho`</sub>

- **English:** "When"
  **Dari:** 
  <sub>`classLifecycle.sectionWhen`</sub>

- **English:** "Class name"
  **Dari:** 
  <sub>`classLifecycle.nameLabel`</sub>

- **English:** "Subject"
  **Dari:** 
  <sub>`classLifecycle.categoryLabel`</sub>

- **English:** "What will students learn?"
  **Dari:** 
  <sub>`classLifecycle.descriptionLabel`</sub>

- **English:** "Language of teaching"
  **Dari:** 
  <sub>`classLifecycle.languageLabel`</sub>

- **English:** "Teacher"
  **Dari:** 
  <sub>`classLifecycle.teacherLabel`</sub>

- **English:** "No teachers yet. Invite one instead."
  **Dari:** 
  <sub>`classLifecycle.noTeachers`</sub>

- **English:** "Day"
  **Dari:** 
  <sub>`classLifecycle.dayLabel`</sub>

- **English:** "Time (Kabul time)"
  **Dari:** 
  <sub>`classLifecycle.timeLabel`</sub>

- **English:** "Length (minutes)"
  **Dari:** 
  <sub>`classLifecycle.durationLabel`</sub>

- **English:** "The class runs every week on this day at this time, Kabul time. Sessions are booked at exactly this time once it is inside the teacher's available hours."
  **Dari:** 
  <sub>`classLifecycle.whenHint`</sub>

- **English:** "The teacher will set each date themselves"
  **Dari:** 
  <sub>`classLifecycle.manualLabel`</sub>

- **English:** "Nothing is booked automatically. The teacher adds each date on their schedule page."
  **Dari:** 
  <sub>`classLifecycle.manualHint`</sub>

- **English:** "More options"
  **Dari:** 
  <sub>`classLifecycle.moreOptions`</sub>

- **English:** "Maximum students"
  **Dari:** 
  <sub>`classLifecycle.maxStudentsLabel`</sub>

- **English:** "WhatsApp group link (optional)"
  **Dari:** 
  <sub>`classLifecycle.whatsappLabel`</sub>

- **English:** "Optional: link to your own Google Form — students see it after they join"
  **Dari:** 
  <sub>`classLifecycle.ownFormLabel`</sub>

- **English:** "Post class"
  **Dari:** 
  <sub>`classLifecycle.submit`</sub>

- **English:** "Posting…"
  **Dari:** 
  <sub>`classLifecycle.submitting`</sub>

- **English:** "Could not post the class. Please check the details and try again."
  **Dari:** 
  <sub>`classLifecycle.createFailed`</sub>

- **English:** "Class posted"
  **Dari:** 
  <sub>`classLifecycle.createdTitle`</sub>

- **English:** "Send this to students on WhatsApp. The link opens a page where they make an account and join the class in one step."
  **Dari:** 
  <sub>`classLifecycle.createdBody`</sub>

- **English:** "Copy link for WhatsApp"
  **Dari:** 
  <sub>`classLifecycle.copyForWhatsApp`</sub>

- **English:** "Copied. Paste it in WhatsApp."
  **Dari:** 
  <sub>`classLifecycle.copiedForWhatsApp`</sub>

- **English:** "Could not copy automatically. Select the text above and copy it."
  **Dari:** 
  <sub>`classLifecycle.copyFailed`</sub>

- **English:** "Join here:"
  **Dari:** 
  <sub>`classLifecycle.whatsappJoinLine`</sub>

- **English:** "Class video link:"
  **Dari:** 
  <sub>`classLifecycle.whatsappMeetLine`</sub>

- **English:** "First session: {time} (Kabul time)"
  **Dari:** 
  <sub>`classLifecycle.firstSessionAt`</sub>

- **English:** "The Meet link is not ready yet. It is retried automatically, or you can paste one on the class page."
  **Dari:** 
  <sub>`classLifecycle.meetPending`</sub>

- **English:** "No session booked yet: the teacher has not set their available hours. They have been sent a message asking them to."
  **Dari:** 
  <sub>`classLifecycle.issueNoAvailability`</sub>

- **English:** "No session booked yet: this class time is outside the teacher's available hours. Change the class time, or ask the teacher to add these hours."
  **Dari:** 
  <sub>`classLifecycle.issueOutsideAvailability`</sub>

- **English:** "No session booked yet: the class day and time could not be read."
  **Dari:** 
  <sub>`classLifecycle.issueUnparseable`</sub>

- **English:** "No session booked yet: this time overlaps another class of the same teacher."
  **Dari:** 
  <sub>`classLifecycle.issueClash`</sub>

- **English:** "A session for this week already exists."
  **Dari:** 
  <sub>`classLifecycle.issueAlreadyHandled`</sub>

- **English:** "The teacher sets the dates. Until they add one, students have nothing to join."
  **Dari:** 
  <sub>`classLifecycle.manualCreated`</sub>

- **English:** "Open the class page"
  **Dari:** 
  <sub>`classLifecycle.openClass`</sub>

- **English:** "Post another class"
  **Dari:** 
  <sub>`classLifecycle.createAnother`</sub>

- **English:** "Live session →"
  **Dari:** 
  <sub>`classLifecycle.liveSession`</sub>

- **English:** "Class questions (Google Form)"
  **Dari:** 
  <sub>`classLifecycle.ownFormLink`</sub>

- **English:** "No upcoming sessions yet."
  **Dari:** 
  <sub>`classLifecycle.noUpcoming`</sub>

- **English:** "Kabul time"
  **Dari:** 
  <sub>`classLifecycle.kabulTime`</sub>

- **English:** "All"
  **Dari:** 
  <sub>`classLifecycle.filterAll`</sub>

- **English:** "Active"
  **Dari:** 
  <sub>`classLifecycle.filterActive`</sub>

- **English:** "Archived"
  **Dari:** 
  <sub>`classLifecycle.filterArchived`</sub>

- **English:** "Page {page} of {total}"
  **Dari:** 
  <sub>`classLifecycle.pageOf`</sub>

- **English:** "← Previous"
  **Dari:** 
  <sub>`classLifecycle.prevPage`</sub>

- **English:** "Next →"
  **Dari:** 
  <sub>`classLifecycle.nextPage`</sub>

- **English:** "This class is archived. Students cannot see it and no sessions run."
  **Dari:** 
  <sub>`classLifecycle.archivedBanner`</sub>

- **English:** "Restore class"
  **Dari:** 
  <sub>`classLifecycle.restore`</sub>

- **English:** "Restoring…"
  **Dari:** 
  <sub>`classLifecycle.restoring`</sub>

- **English:** "Could not restore the class. Please try again."
  **Dari:** 
  <sub>`classLifecycle.restoreFailed`</sub>

- **English:** "The next sessions, Kabul time. If a Meet link is missing, paste one here."
  **Dari:** 
  <sub>`classLifecycle.sessionsHint`</sub>

- **English:** "Meet link"
  **Dari:** 
  <sub>`classLifecycle.meetLinkLabel`</sub>

- **English:** "Save link"
  **Dari:** 
  <sub>`classLifecycle.meetLinkSave`</sub>

- **English:** "Saved"
  **Dari:** 
  <sub>`classLifecycle.meetLinkSaved`</sub>

- **English:** "Could not save the link."
  **Dari:** 
  <sub>`classLifecycle.meetLinkFailed`</sub>

- **English:** "Change any field and save. Fields you leave as they are stay the same."
  **Dari:** 
  <sub>`classLifecycle.editIntro`</sub>

- **English:** "Nothing was changed."
  **Dari:** 
  <sub>`classLifecycle.nothingChanged`</sub>

- **English:** "Sessions already booked keep their time. New sessions use the new day and time."
  **Dari:** 
  <sub>`classLifecycle.scheduleChangeHint`</sub>

- **English:** "You set the dates for this class yourself."
  **Dari:** 
  <sub>`classLifecycle.manualClass`</sub>

- **English:** "Add sessions"
  **Dari:** 
  <sub>`classLifecycle.addSessions`</sub>

- **English:** "Not booked: the class time is outside the hours you set. Add these hours, or ask the team to change the class time."
  **Dari:** 
  <sub>`classLifecycle.problemOutsideAvailability`</sub>

- **English:** "Not booked: the class time is unclear. Ask the team to set the class day and time."
  **Dari:** 
  <sub>`classLifecycle.problemUnparseable`</sub>


## `teacherSetup`  ·  26 strings

- **English:** "Getting started"
  **Dari:** 
  <sub>`teacherSetup.kicker`</sub>

- **English:** "Set up your class"
  **Dari:** 
  <sub>`teacherSetup.title`</sub>

- **English:** "One step before your class can run. It takes about two minutes."
  **Dari:** 
  <sub>`teacherSetup.subtitle`</sub>

- **English:** "You are all set. Your sessions are created automatically from the hours you set."
  **Dari:** 
  <sub>`teacherSetup.subtitleDone`</sub>

- **English:** "Set the hours you can teach"
  **Dari:** 
  <sub>`teacherSetup.step1Title`</sub>

- **English:** "Tick each day you teach, enter a start and end time, and save. Once you have saved hours, sessions are only created inside them. Until then, classes run at the time chosen when they were posted."
  **Dari:** 
  <sub>`teacherSetup.step1Body`</sub>

- **English:** "Saved for {days} day(s) a week. Change it any time."
  **Dari:** 
  <sub>`teacherSetup.step1Done`</sub>

- **English:** "Set my hours"
  **Dari:** 
  <sub>`teacherSetup.step1Cta`</sub>

- **English:** "Change my hours"
  **Dari:** 
  <sub>`teacherSetup.step1Change`</sub>

- **English:** "Connect your Google account (optional)"
  **Dari:** 
  <sub>`teacherSetup.step2Title`</sub>

- **English:** "Only if you want the Meet invitation in your own calendar, so you get the reminder and can edit it. If you skip this, your sessions still get a Meet link — it is created on the AlphaSeekers calendar instead."
  **Dari:** 
  <sub>`teacherSetup.step2Body`</sub>

- **English:** "Connected as {account}."
  **Dari:** 
  <sub>`teacherSetup.step2Done`</sub>

- **English:** "Connect Google"
  **Dari:** 
  <sub>`teacherSetup.step2Cta`</sub>

- **English:** "Reconnect Google"
  **Dari:** 
  <sub>`teacherSetup.step2Change`</sub>

- **English:** "Your classes"
  **Dari:** 
  <sub>`teacherSetup.yourClasses`</sub>

- **English:** "{count} session(s) scheduled"
  **Dari:** 
  <sub>`teacherSetup.sessionsScheduled`</sub>

- **English:** "No sessions yet — finish the steps above"
  **Dari:** 
  <sub>`teacherSetup.noSessionsYet`</sub>

- **English:** "Sessions will be created within the hour"
  **Dari:** 
  <sub>`teacherSetup.sessionsComing`</sub>

- **English:** "{count} enrolled"
  **Dari:** 
  <sub>`teacherSetup.enrolled`</sub>

- **English:** "What happens next"
  **Dari:** 
  <sub>`teacherSetup.nextTitle`</sub>

- **English:** "Your sessions appear automatically within the hour."
  **Dari:** 
  <sub>`teacherSetup.next1`</sub>

- **English:** "Each one gets a Google Meet link."
  **Dari:** 
  <sub>`teacherSetup.next2`</sub>

- **English:** "Enrolled students are notified, and reminded before every class."
  **Dari:** 
  <sub>`teacherSetup.next3`</sub>

- **English:** "Nothing appearing after an hour? Report it in"
  **Dari:** 
  <sub>`teacherSetup.helpPrefix`</sub>

- **English:** " and we will look into it."
  **Dari:** 
  <sub>`teacherSetup.helpSuffix`</sub>

- **English:** "Optional"
  **Dari:** 
  <sub>`teacherSetup.optional`</sub>


## `support`  ·  46 strings

- **English:** "Requests & issues"
  **Dari:** 
  <sub>`support.queueTitle`</sub>

- **English:** "Report a bug, request a feature, or ask a question. Everything filed here is reviewed and answered on this page — no email needed."
  **Dari:** 
  <sub>`support.queueSubtitle`</sub>

- **English:** "Back to admin"
  **Dari:** 
  <sub>`support.backToAdmin`</sub>

- **English:** "Back to all tickets"
  **Dari:** 
  <sub>`support.backToQueue`</sub>

- **English:** "New request"
  **Dari:** 
  <sub>`support.newTicket`</sub>

- **English:** "Status"
  **Dari:** 
  <sub>`support.filterStatus`</sub>

- **English:** "Type"
  **Dari:** 
  <sub>`support.filterType`</sub>

- **English:** "All statuses"
  **Dari:** 
  <sub>`support.statusAll`</sub>

- **English:** "All types"
  **Dari:** 
  <sub>`support.typeAll`</sub>

- **English:** "Open"
  **Dari:** 
  <sub>`support.status_OPEN`</sub>

- **English:** "In progress"
  **Dari:** 
  <sub>`support.status_IN_PROGRESS`</sub>

- **English:** "Done"
  **Dari:** 
  <sub>`support.status_DONE`</sub>

- **English:** "Won't do"
  **Dari:** 
  <sub>`support.status_WONT_DO`</sub>

- **English:** "Bug"
  **Dari:** 
  <sub>`support.type_BUG`</sub>

- **English:** "Feature request"
  **Dari:** 
  <sub>`support.type_FEATURE`</sub>

- **English:** "Question"
  **Dari:** 
  <sub>`support.type_QUESTION`</sub>

- **English:** "Urgent"
  **Dari:** 
  <sub>`support.urgent`</sub>

- **English:** "Normal"
  **Dari:** 
  <sub>`support.priorityNormal`</sub>

- **English:** "Urgent — something is broken for users right now"
  **Dari:** 
  <sub>`support.priorityUrgent`</sub>

- **English:** "Summary"
  **Dari:** 
  <sub>`support.fieldTitle`</sub>

- **English:** "One line: what is wrong, or what you want added"
  **Dari:** 
  <sub>`support.fieldTitlePlaceholder`</sub>

- **English:** "Type"
  **Dari:** 
  <sub>`support.fieldType`</sub>

- **English:** "Priority"
  **Dari:** 
  <sub>`support.fieldPriority`</sub>

- **English:** "Where (optional)"
  **Dari:** 
  <sub>`support.fieldArea`</sub>

- **English:** "e.g. Create Class page"
  **Dari:** 
  <sub>`support.fieldAreaPlaceholder`</sub>

- **English:** "Details"
  **Dari:** 
  <sub>`support.fieldDescription`</sub>

- **English:** "What did you do, what did you expect, and what happened instead?"
  **Dari:** 
  <sub>`support.fieldDescriptionPlaceholder`</sub>

- **English:** "Screenshot (optional)"
  **Dari:** 
  <sub>`support.fieldScreenshot`</sub>

- **English:** "PNG, JPEG or WebP, up to 2 MB. One image per request."
  **Dari:** 
  <sub>`support.screenshotHint`</sub>

- **English:** "Your request was saved, but the screenshot did not attach: {reason}"
  **Dari:** 
  <sub>`support.attachmentFailed`</sub>

- **English:** "Submit"
  **Dari:** 
  <sub>`support.submitTicket`</sub>

- **English:** "Cancel"
  **Dari:** 
  <sub>`support.cancel`</sub>

- **English:** "Saving..."
  **Dari:** 
  <sub>`support.saving`</sub>

- **English:** "Could not save. Please try again."
  **Dari:** 
  <sub>`support.saveFailed`</sub>

- **English:** "Could not load tickets. Please refresh."
  **Dari:** 
  <sub>`support.loadFailed`</sub>

- **English:** "Loading..."
  **Dari:** 
  <sub>`support.loading`</sub>

- **English:** "Nothing here. When something breaks or you want a change, file it and it will be picked up."
  **Dari:** 
  <sub>`support.empty`</sub>

- **English:** "Reported by {name}"
  **Dari:** 
  <sub>`support.reportedBy`</sub>

- **English:** "{count} replies"
  **Dari:** 
  <sub>`support.commentCount`</sub>

- **English:** "Conversation"
  **Dari:** 
  <sub>`support.conversation`</sub>

- **English:** "No replies yet."
  **Dari:** 
  <sub>`support.noComments`</sub>

- **English:** "Write a reply..."
  **Dari:** 
  <sub>`support.replyPlaceholder`</sub>

- **English:** "Post reply"
  **Dari:** 
  <sub>`support.postReply`</sub>

- **English:** "Set status"
  **Dari:** 
  <sub>`support.setStatus`</sub>

- **English:** "View attachment"
  **Dari:** 
  <sub>`support.viewAttachment`</sub>

- **English:** "You can file and reply to tickets. Changing a ticket's status is limited to full admins."
  **Dari:** 
  <sub>`support.manageHint`</sub>


## `adminForms`  ·  31 strings

- **English:** "Manage users"
  **Dari:** 
  <sub>`adminForms.manageUsers`</sub>

- **English:** "Approve new sign-ups, correct a wrong role, or remove an account. Someone who signed up as a Student will not appear in the Create Class lecturer list until their role is set to Teacher."
  **Dari:** 
  <sub>`adminForms.manageUsersSubtitle`</sub>

- **English:** "No users match these filters."
  **Dari:** 
  <sub>`adminForms.noUsers`</sub>

- **English:** "Filter by status"
  **Dari:** 
  <sub>`adminForms.filterStatus`</sub>

- **English:** "Filter by role"
  **Dari:** 
  <sub>`adminForms.filterRole`</sub>

- **English:** "Pending approval"
  **Dari:** 
  <sub>`adminForms.statusPENDING`</sub>

- **English:** "Approved"
  **Dari:** 
  <sub>`adminForms.statusAPPROVED`</sub>

- **English:** "All statuses"
  **Dari:** 
  <sub>`adminForms.statusALL`</sub>

- **English:** "All roles"
  **Dari:** 
  <sub>`adminForms.roleALL`</sub>

- **English:** "Student"
  **Dari:** 
  <sub>`adminForms.roleSTUDENT`</sub>

- **English:** "Teacher"
  **Dari:** 
  <sub>`adminForms.roleTEACHER`</sub>

- **English:** "Admin"
  **Dari:** 
  <sub>`adminForms.roleADMIN`</sub>

- **English:** "Approved"
  **Dari:** 
  <sub>`adminForms.approvedLabel`</sub>

- **English:** "Delete"
  **Dari:** 
  <sub>`adminForms.delete`</sub>

- **English:** "Delete permanently?"
  **Dari:** 
  <sub>`adminForms.deleteConfirm`</sub>

- **English:** "Yes, delete"
  **Dari:** 
  <sub>`adminForms.deleteYes`</sub>

- **English:** "Cancel"
  **Dari:** 
  <sub>`adminForms.cancel`</sub>

- **English:** "Could not delete this user."
  **Dari:** 
  <sub>`adminForms.deleteFailed`</sub>

- **English:** "User deleted."
  **Dari:** 
  <sub>`adminForms.userDeleted`</sub>

- **English:** "Could not change this user's role."
  **Dari:** 
  <sub>`adminForms.roleChangeFailed`</sub>

- **English:** "Role changed to {role}."
  **Dari:** 
  <sub>`adminForms.roleChanged`</sub>

- **English:** "Still teaching"
  **Dari:** 
  <sub>`adminForms.blockerClasses`</sub>

- **English:** "Uploaded materials"
  **Dari:** 
  <sub>`adminForms.blockerMaterials`</sub>

- **English:** "Applied as {role}"
  **Dari:** 
  <sub>`adminForms.requestedRole`</sub>

- **English:** "Grant"
  **Dari:** 
  <sub>`adminForms.grantRequested`</sub>

- **English:** "Teacher requests"
  **Dari:** 
  <sub>`adminForms.statusTEACHER_REQUESTS`</sub>

- **English:** "Change role to {role}?"
  **Dari:** 
  <sub>`adminForms.confirmRoleChange`</sub>

- **English:** "Yes, change"
  **Dari:** 
  <sub>`adminForms.confirmRoleYes`</sub>

- **English:** "Decline"
  **Dari:** 
  <sub>`adminForms.declineRequest`</sub>

- **English:** "Teacher request declined."
  **Dari:** 
  <sub>`adminForms.requestDeclined`</sub>

- **English:** "Page {current} / {total} ({count} users)"
  **Dari:** 
  <sub>`adminForms.pageInfoTotal`</sub>


## `adminClassDetail`  ·  23 strings

- **English:** "Danger zone"
  **Dari:** 
  <sub>`adminClassDetail.dangerZone`</sub>

- **English:** "Remove this class from the platform. Archiving is reversible; permanent deletion is not."
  **Dari:** 
  <sub>`adminClassDetail.dangerZoneDesc`</sub>

- **English:** "Archive class"
  **Dari:** 
  <sub>`adminClassDetail.archiveTitle`</sub>

- **English:** "Hides the class from students. You keep all its records and can restore it later."
  **Dari:** 
  <sub>`adminClassDetail.archiveDesc`</sub>

- **English:** "Archive"
  **Dari:** 
  <sub>`adminClassDetail.archiveButton`</sub>

- **English:** "Yes, archive"
  **Dari:** 
  <sub>`adminClassDetail.archiveConfirm`</sub>

- **English:** "Archiving…"
  **Dari:** 
  <sub>`adminClassDetail.archiving`</sub>

- **English:** "Cancel"
  **Dari:** 
  <sub>`adminClassDetail.cancel`</sub>

- **English:** "Delete permanently"
  **Dari:** 
  <sub>`adminClassDetail.deleteTitle`</sub>

- **English:** "Erases this class and all its sessions, enrollments, attendance and materials. This cannot be undone."
  **Dari:** 
  <sub>`adminClassDetail.deleteDesc`</sub>

- **English:** "Delete permanently"
  **Dari:** 
  <sub>`adminClassDetail.deleteButton`</sub>

- **English:** "Type the class name ({name}) to confirm."
  **Dari:** 
  <sub>`adminClassDetail.deleteTypePrompt`</sub>

- **English:** "Delete forever"
  **Dari:** 
  <sub>`adminClassDetail.deleteConfirmButton`</sub>

- **English:** "Deleting…"
  **Dari:** 
  <sub>`adminClassDetail.deleting`</sub>

- **English:** "Something went wrong. Please try again."
  **Dari:** 
  <sub>`adminClassDetail.actionFailed`</sub>

- **English:** "Permanently deleting a class is limited to super admins. Archiving is available to you above — ask Hadi, Sahar or Shahla if a class needs to be removed for good."
  **Dari:** 
  <sub>`adminClassDetail.deleteSuperOnly`</sub>

- **English:** "Requests to join"
  **Dari:** 
  <sub>`adminClassDetail.requests`</sub>

- **English:** "waiting"
  **Dari:** 
  <sub>`adminClassDetail.waiting`</sub>

- **English:** "No one is waiting to join this class."
  **Dari:** 
  <sub>`adminClassDetail.noRequests`</sub>

- **English:** "Approve"
  **Dari:** 
  <sub>`adminClassDetail.approveRequest`</sub>

- **English:** "Decline"
  **Dari:** 
  <sub>`adminClassDetail.rejectRequest`</sub>

- **English:** "Approved"
  **Dari:** 
  <sub>`adminClassDetail.requestApproved`</sub>

- **English:** "Declined"
  **Dari:** 
  <sub>`adminClassDetail.requestRejected`</sub>


## `siteSettings`  ·  15 strings

- **English:** "Site Settings"
  **Dari:** 
  <sub>`siteSettings.title`</sub>

- **English:** "Manage public-facing social media links and contact information."
  **Dari:** 
  <sub>`siteSettings.subtitle`</sub>

- **English:** "Instagram URL"
  **Dari:** 
  <sub>`siteSettings.instagram`</sub>

- **English:** "Facebook URL"
  **Dari:** 
  <sub>`siteSettings.facebook`</sub>

- **English:** "X (Twitter) URL"
  **Dari:** 
  <sub>`siteSettings.twitter`</sub>

- **English:** "LinkedIn URL"
  **Dari:** 
  <sub>`siteSettings.linkedin`</sub>

- **English:** "YouTube URL"
  **Dari:** 
  <sub>`siteSettings.youtube`</sub>

- **English:** "Telegram URL"
  **Dari:** 
  <sub>`siteSettings.telegram`</sub>

- **English:** "WhatsApp URL"
  **Dari:** 
  <sub>`siteSettings.whatsapp`</sub>

- **English:** "Contact Email"
  **Dari:** 
  <sub>`siteSettings.contactEmail`</sub>

- **English:** "Save"
  **Dari:** 
  <sub>`siteSettings.save`</sub>

- **English:** "Saving..."
  **Dari:** 
  <sub>`siteSettings.saving`</sub>

- **English:** "Saved"
  **Dari:** 
  <sub>`siteSettings.saved`</sub>

- **English:** "Could not save. Please try again."
  **Dari:** 
  <sub>`siteSettings.failed`</sub>

- **English:** "Paste the full URL for each social account. Leave a field blank to hide that icon from the public site."
  **Dari:** 
  <sub>`siteSettings.helpUrl`</sub>


## `storyEditor`  ·  7 strings

- **English:** "The title must be at least 3 characters."
  **Dari:** 
  <sub>`storyEditor.titleTooShort`</sub>

- **English:** "Please choose an image file."
  **Dari:** 
  <sub>`storyEditor.selectImage`</sub>

- **English:** "The image must be smaller than 5 MB."
  **Dari:** 
  <sub>`storyEditor.imageTooLarge`</sub>

- **English:** "Write something first, then ask the AI for help."
  **Dari:** 
  <sub>`storyEditor.writeFirst`</sub>

- **English:** "The AI could not answer right now. Please try again."
  **Dari:** 
  <sub>`storyEditor.aiFailed`</sub>

- **English:** "No suggestions this time."
  **Dari:** 
  <sub>`storyEditor.noSuggestions`</sub>

- **English:** "Only the first part of your text was checked — the AI helper reads up to about 1,000 characters at a time. Select a part of your text to check that part instead."
  **Dari:** 
  <sub>`storyEditor.aiTrimmed`</sub>


## `contentForms`  ·  4 strings

- **English:** "File attached"
  **Dari:** 
  <sub>`contentForms.fileAttached`</sub>

- **English:** "File uploads are not configured yet. Please contact the administrator."
  **Dari:** 
  <sub>`contentForms.uploadNotConfigured`</sub>

- **English:** "Upload failed. Please try again."
  **Dari:** 
  <sub>`contentForms.uploadFailed`</sub>

- **English:** "Link to apply"
  **Dari:** 
  <sub>`contentForms.applyLink`</sub>


## `admin`  ·  3 strings

- **English:** "Manage users"
  **Dari:** 
  <sub>`admin.manageUsersTitle`</sub>

- **English:** "Approve new sign-ups, change someone's role, or remove an account."
  **Dari:** 
  <sub>`admin.manageUsersSubtitle`</sub>

- **English:** "Could not delete. Please try again."
  **Dari:** 
  <sub>`admin.deleteFailed`</sub>


## `materials`  ·  2 strings

- **English:** "Or paste a link"
  **Dari:** 
  <sub>`materials.orPasteLink`</sub>

- **English:** "Share a Google Drive, OneDrive or public PDF link. Make sure it is set so students can open it."
  **Dari:** 
  <sub>`materials.linkHint`</sub>


## `staffForms`  ·  2 strings

- **English:** "Registration deadline (optional)"
  **Dari:** 
  <sub>`staffForms.registrationDeadlineLabel`</sub>

- **English:** "The last day students can ask to join. Leave blank to keep the class open."
  **Dari:** 
  <sub>`staffForms.registrationDeadlineHint`</sub>


## `stories`  ·  2 strings

- **English:** "Anonymous"
  **Dari:** 
  <sub>`stories.anonymous`</sub>

- **English:** "Student"
  **Dari:** 
  <sub>`stories.student`</sub>


## `upload`  ·  1 string

- **English:** "File uploads are not set up yet. Please contact the administrator."
  **Dari:** 
  <sub>`upload.notConfigured`</sub>


## `learn`  ·  1 string

- **English:** "I could not answer that — try asking a different way."
  **Dari:** 
  <sub>`learn.chatNoAnswer`</sub>
