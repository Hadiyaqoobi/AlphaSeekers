# Dari translation needed

**220 strings** in the app are still showing **English** to Dari readers.
The keys exist in `messages/fa.json`, so nothing errors — the English text was just left in place
when these features shipped. Affected areas include password reset, the contact page, the support
queue, teacher setup, and the admin user/class screens.

## Who fills this in

A native Dari speaker on the team. **Please do not run this through Google Translate or an AI**
— machine-translated Dari has gone out on this platform before and had to be pulled. If a string
is awkward to translate, leave it blank and say so; blank is better than wrong.

## How to fill it in

Write the Dari next to each line. Anything in curly braces — `{count}`, `{name}`, `{date}` —
is a value the app substitutes at runtime. **Keep those exactly as they are**, including the braces;
you can move them to wherever they belong in the Dari sentence, but do not translate or rename them.

Send the finished file back and we will load it in. A test now blocks any *new* English-only
string from being added, so this list can only get shorter.

---

## Support / ticket queue  ·  46 strings

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

## Teacher 'set up your class' page  ·  26 strings

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

- **English:** "Tick each day you teach, enter a start and end time, and save. Sessions are only ever created inside these hours — the platform never guesses a time for you."
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

## Admin — manage users  ·  25 strings

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

## Admin — class detail (archive / delete / join requests)  ·  23 strings

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

## Public landing page  ·  22 strings

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

## Admin — site settings (social links)  ·  15 strings

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

## Set a new password  ·  13 strings

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

## Public contact page  ·  13 strings

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

## Dashboard  ·  8 strings

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

## Forgot password  ·  7 strings

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

## Navigation menu  ·  5 strings

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

## Sign-up page  ·  5 strings

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

## Content forms (uploads)  ·  3 strings

- **English:** "File attached"
  **Dari:** 
  <sub>`contentForms.fileAttached`</sub>

- **English:** "File uploads are not configured yet. Please contact the administrator."
  **Dari:** 
  <sub>`contentForms.uploadNotConfigured`</sub>

- **English:** "Upload failed. Please try again."
  **Dari:** 
  <sub>`contentForms.uploadFailed`</sub>

## Class enrolment  ·  2 strings

- **English:** "Request to join"
  **Dari:** 
  <sub>`enroll.requestToJoin`</sub>

- **English:** "Request sent — an admin will review it."
  **Dari:** 
  <sub>`enroll.requestSent`</sub>

## Class materials  ·  2 strings

- **English:** "Or paste a link"
  **Dari:** 
  <sub>`materials.orPasteLink`</sub>

- **English:** "Share a Google Drive, OneDrive or public PDF link. Make sure it is set so students can open it."
  **Dari:** 
  <sub>`materials.linkHint`</sub>

## My profile  ·  2 strings

- **English:** "Current password is incorrect."
  **Dari:** 
  <sub>`profile.password.errors.wrongCurrent`</sub>

- **English:** "New password must be different from your current password."
  **Dari:** 
  <sub>`profile.password.errors.sameAsCurrent`</sub>

## Admin — misc  ·  2 strings

- **English:** "Manage users"
  **Dari:** 
  <sub>`admin.manageUsersTitle`</sub>

- **English:** "Approve new sign-ups, change someone's role, or remove an account."
  **Dari:** 
  <sub>`admin.manageUsersSubtitle`</sub>

## File upload  ·  1 strings

- **English:** "File uploads are not set up yet. Please contact the administrator."
  **Dari:** 
  <sub>`upload.notConfigured`</sub>
