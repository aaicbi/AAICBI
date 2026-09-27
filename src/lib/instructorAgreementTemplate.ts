/**
 * The AAICBI Instructor Letter of Engagement, verbatim (all 24
 * sections), with its bracketed blanks converted to {{TOKEN}} merge
 * fields for resolveTemplate() (see the send-agreement route). Section
 * 24's physical signature lines are the one deliberate departure from
 * the source document — this is a digital agreement, accepted through
 * the Instructor Portal's own scroll-to-read + checkboxes + typed-name
 * flow (InstructorAgreement.acceptedName/acceptedAt/acceptedIp), so a
 * blank line meant for a pen signature would never actually get filled.
 *
 * Offered as a one-click starting point from /admin/agreement-templates
 * ("Use AAICBI Standard Letter of Engagement") rather than silently
 * auto-created — an admin can edit the wording afterward like any other
 * template, and it isn't forced onto an account that wants its own.
 */
export const DEFAULT_INSTRUCTOR_AGREEMENT_NAME = "AAICBI Standard Instructor Letter of Engagement";

export const DEFAULT_INSTRUCTOR_AGREEMENT_CONTENT = `AFRICA AI CAPACITY BUILDING INITIATIVE (AAICBI)

INSTRUCTOR LETTER OF ENGAGEMENT

Date: {{LETTER_DATE}}

Instructor Name: {{INSTRUCTOR_NAME}}
Address: {{INSTRUCTOR_ADDRESS}}
Email: {{INSTRUCTOR_EMAIL}}
Phone Number: {{INSTRUCTOR_PHONE}}

SUBJECT: LETTER OF ENGAGEMENT AS AN AAICBI INSTRUCTOR

Dear {{INSTRUCTOR_NAME}},

We are pleased to formally engage you as an Instructor with the Africa AI Capacity Building Initiative (AAICBI), operated in collaboration with Futybills Tech, subject to the terms and conditions contained in this Letter of Engagement.

This engagement is based on your professional knowledge, experience, teaching ability, and commitment to supporting the development of trainees enrolled in the relevant AAICBI training programme.

Our objective is to provide trainees with quality instruction, practical knowledge, mentorship, accountability, and industry-relevant learning experiences.

1. POSITION AND COURSE

You are being engaged as an:

Position: {{POSITION}}

Course/Programme: {{COURSE_NAME}}

Course Duration: {{COURSE_DURATION}}

Expected Start Date: {{START_DATE}}

Expected End Date: {{END_DATE}}

Your primary responsibility will be to deliver the assigned course in accordance with the approved AAICBI curriculum, learning objectives, instructional standards, and programme schedule.

2. REMUNERATION

The starting remuneration for the instructor engagement shall be:

{{REMUNERATION_AMOUNT}}

for the agreed course engagement, subject to the terms contained in this agreement.

Payment shall be made according to the agreed payment schedule:

Payment Schedule: {{PAYMENT_SCHEDULE}}

Payment Date: {{PAYMENT_DATE}}

The instructor acknowledges that payment is subject to the satisfactory fulfilment of the responsibilities outlined in this Letter of Engagement.

3. REMUNERATION REVIEW

AAICBI/Futybills Tech recognizes that course growth may require a review of instructor remuneration.

The instructor's remuneration shall therefore be reviewed when the number of active users/subscribers enrolled under the relevant course exceeds 100 users.

Crossing the 100-user threshold shall trigger a remuneration review and discussion. It shall not automatically constitute an increase to a predetermined amount.

Any revised remuneration shall be mutually agreed upon and documented in writing by the parties before taking effect.

The review may take into consideration factors including:

- Number of active trainees;
- Course workload;
- Number of classes and sessions;
- Mentoring responsibilities;
- Trainee engagement;
- Instructor performance;
- Course duration;
- Additional responsibilities assigned to the instructor; and
- Overall programme requirements.

4. LIVE TEACHING SESSIONS

The instructor shall conduct at least one mandatory live teaching session every week throughout the agreed training period.

The usual live-session schedule shall be:

Day: {{LIVE_SESSION_DAY}}

Time: {{LIVE_SESSION_TIME}}

Platform: {{LIVE_SESSION_PLATFORM}}

The instructor is expected to:

1. Attend and conduct scheduled live sessions punctually.
2. Prepare adequately for each session.
3. Teach according to the approved curriculum and learning objectives.
4. Explain concepts clearly and practically.
5. Allow trainees reasonable opportunities to ask questions.
6. Provide appropriate practical demonstrations and examples.
7. Monitor trainee understanding and participation.
8. Encourage trainees to complete assigned learning activities.
9. Maintain a professional learning environment.
10. Record or otherwise provide a suitable learning resource where required.

Live teaching sessions are a mandatory responsibility of this engagement.

5. UNAVAILABILITY FOR A SCHEDULED LIVE SESSION

The instructor is expected to notify the trainee group and the appropriate AAICBI/Futybills Tech administrator as soon as reasonably possible if they will be unavailable for their normally scheduled live session.

Where the instructor cannot conduct the live session at the allocated time, the instructor shall, where reasonably practicable:

1. Inform the trainee group of the change;
2. Notify the designated AAICBI/Futybills Tech administrator;
3. Provide a recorded lesson covering the material scheduled for that session; and
4. Where necessary, arrange an alternative live session or other approved learning activity.

The purpose of this requirement is to ensure that trainees do not lose access to the week's learning because of the instructor's temporary unavailability.

Repeated failure to attend scheduled sessions or provide the required alternative learning support may be considered a performance issue.

6. TRAINEE MENTORING AND WHATSAPP SUPPORT

In addition to live teaching, the instructor shall provide reasonable academic mentorship and learning support to trainees through the designated WhatsApp group or other communication platform approved by AAICBI/Futybills Tech.

The instructor's mentoring responsibilities may include:

- Answering reasonable course-related questions;
- Clarifying difficult concepts;
- Guiding trainees on assignments and practical exercises;
- Encouraging trainees who are experiencing learning difficulties;
- Providing constructive academic feedback;
- Directing trainees to relevant learning resources;
- Encouraging participation and consistency;
- Identifying significant learning difficulties and reporting them to the appropriate administrator; and
- Helping trainees remain focused on the objectives of the programme.

The WhatsApp group and other official communication channels shall primarily be used for professional and academic purposes.

7. CURRICULUM AND TRAINING MATERIALS

The instructor shall teach in accordance with the curriculum, course objectives, lesson plans, instructional materials, and other guidelines approved by AAICBI/Futybills Tech.

The instructor shall not materially alter the approved curriculum in a manner that causes trainees to miss essential learning objectives without prior approval.

Where the instructor believes that additional material would substantially improve the course, the instructor may recommend such material to the appropriate administrator for review and approval.

8. OWNERSHIP OF TRAINING MATERIALS AND INTELLECTUAL PROPERTY

All training materials supplied by AAICBI/Futybills Tech or Futybills Tech, including but not limited to: course notes; lesson plans; slides; presentations; videos; recorded classes; assignments; assessments; question banks; projects; templates; curriculum structures; learning resources; graphics; documents; course frameworks; and other proprietary educational materials, shall remain the property of Futybills Tech and/or the applicable rights holder.

The instructor shall not reproduce, sell, distribute, publish, upload, license, transfer, or commercially exploit such materials outside the authorized AAICBI/Futybills Tech programme without prior written authorization.

Where an instructor creates course-specific materials specifically for the engagement using resources, curriculum, instructions, or proprietary materials supplied by Futybills Tech, ownership and permitted use shall be determined in accordance with the applicable written agreement between the parties.

The instructor shall not use proprietary AAICBI/Futybills Tech materials to establish or support a competing training programme without prior written permission.

9. CONFIDENTIALITY

During and after the engagement, the instructor shall maintain the confidentiality of confidential information obtained through their engagement with AAICBI/Futybills Tech.

Confidential information may include: trainee information; trainee performance records; assessment results; internal business information; administrative information; financial information; course development information; platform information; login credentials; proprietary teaching materials; internal policies and procedures; information concerning other instructors; information concerning business partners; and other information reasonably understood to be confidential.

The instructor shall not disclose confidential information to unauthorized persons or use it for purposes unrelated to the instructor's responsibilities.

10. TRAINEE DATA AND PRIVACY

The instructor shall treat trainee information responsibly and shall only access, use, store, or share trainee information for legitimate educational and administrative purposes authorized by AAICBI/Futybills Tech.

The instructor shall not: sell trainee information; share trainee contact information for unauthorized purposes; use trainee information for personal marketing; export or distribute trainee databases; share private trainee records publicly; or use platform information for unrelated commercial purposes.

Any suspected unauthorized access, disclosure, or loss of trainee information should be reported promptly to the appropriate AAICBI/Futybills Tech administrator.

11. PROFESSIONAL CONDUCT

The instructor shall conduct themselves professionally when interacting with trainees, administrators, other instructors, partners, and representatives of AAICBI/Futybills Tech.

The instructor is expected to: treat trainees respectfully; avoid discriminatory or abusive conduct; maintain appropriate professional boundaries; avoid harassment or inappropriate communication; avoid using the training platform for unrelated personal or commercial activities; provide constructive feedback; respect the policies and procedures of AAICBI/Futybills Tech; and protect the reputation and integrity of the programme.

12. TRAINEE RELATIONSHIPS AND COMMERCIAL ACTIVITIES

The instructor shall not use their position to improperly solicit trainees for unrelated commercial activities.

Any opportunity to provide trainees with external services, paid programmes, products, employment opportunities, or other commercial offers must be disclosed and handled in accordance with AAICBI/Futybills Tech policies.

The instructor shall not pressure trainees to purchase unrelated products or services.

13. ASSESSMENT AND TRAINEE PERFORMANCE

Where applicable, the instructor shall participate in the assessment and monitoring of trainee performance. This may include: reviewing assignments; providing feedback; participating in practical exercises; supporting assessments; identifying trainees who require additional support; providing recommendations concerning trainee progress; and submitting required reports to the programme administrator.

The instructor shall provide honest and objective academic feedback and shall not manipulate trainee results.

14. ATTENDANCE AND RESPONSIVENESS

The instructor is expected to maintain reasonable availability for: scheduled live classes; approved mentoring activities; course-related communication; academic questions from trainees; meetings with AAICBI/Futybills Tech administrators where reasonably required; and other activities directly related to the successful delivery of the assigned course.

The instructor should respond to official course-related communications within a reasonable period.

15. RECORDING AND USE OF LIVE SESSIONS

Where AAICBI/Futybills Tech records live teaching sessions for educational purposes, such recordings may be retained and used within the authorized learning environment for the benefit of enrolled trainees.

The instructor acknowledges that recordings may form part of the course's educational resources.

Any public, promotional, commercial, or external use of the instructor's recordings or likeness should be subject to the applicable authorization and agreement of the parties.

16. REPORTING REQUIREMENTS

The instructor may be required to submit periodic reports concerning the course and trainee activities. Reports may include: attendance; topics covered; trainee participation; assignment completion; general trainee performance; learning challenges; technical difficulties; recommended interventions; and progress against the approved course schedule.

The frequency and format of such reports shall be communicated by AAICBI/Futybills Tech.

17. CHANGES TO COURSE SCHEDULE

AAICBI/Futybills Tech may make reasonable adjustments to the course schedule where necessary due to programme requirements, public holidays, technical issues, platform changes, or other operational circumstances.

Reasonable notice shall be provided to the instructor where practicable.

The instructor shall cooperate with reasonable schedule adjustments and communicate any significant scheduling conflicts promptly.

18. RESIGNATION BY THE INSTRUCTOR

An instructor who wishes to resign from the engagement shall provide {{NOTICE_PERIOD}} written notice to AAICBI/Futybills Tech.

The notice should be communicated to the designated employer/administrator through the approved official communication channel.

During the notice period, the instructor shall continue to fulfil their responsibilities unless otherwise agreed in writing.

The instructor shall cooperate with a reasonable handover process, including providing relevant course information, outstanding trainee feedback, teaching materials belonging to Futybills Tech, and other information necessary to ensure continuity of the training programme.

19. TERMINATION BY AAICBI/FUTYBILLS TECH

AAICBI/Futybills Tech may terminate the instructor's engagement in accordance with the terms of this agreement and applicable law.

Possible grounds for termination may include: persistent failure to conduct scheduled live sessions; repeated failure to provide required learning support; serious misconduct; unauthorized disclosure of confidential information; misuse of trainee information; unauthorized use or distribution of proprietary materials; falsification of records; serious or repeated violation of programme policies; conduct that materially damages the integrity of the programme; or other substantial breaches of the terms of this engagement.

Where appropriate, the instructor may be given an opportunity to address performance or conduct concerns before termination.

20. HANDOVER UPON TERMINATION OR RESIGNATION

Upon completion or termination of the engagement, the instructor shall return or surrender access to all AAICBI/Futybills Tech resources and systems as required. This may include: platform access; administrative accounts; course materials; trainee information; assessment records; teaching resources; documents; recordings; internal communication channels; and other organizational property.

The instructor shall not retain or use confidential organizational or trainee information after the engagement ends.

21. INDEPENDENT PROFESSIONAL ENGAGEMENT

Unless otherwise expressly stated in a separate written agreement, this Letter of Engagement is intended to define the instructor's professional engagement and responsibilities for the assigned AAICBI programme.

Nothing in this document should be interpreted as creating rights or obligations beyond those expressly agreed by the parties or required by applicable law.

22. POLICIES AND FUTURE GUIDELINES

The instructor agrees to comply with reasonable policies, procedures, academic standards, technology requirements, and operational guidelines communicated by AAICBI/Futybills Tech from time to time.

Where a new policy materially changes the instructor's contractual obligations or remuneration, the change should be communicated and documented appropriately.

23. GOVERNING LAW

This engagement shall be governed by the applicable laws of the Federal Republic of Nigeria.

Any dispute arising from this engagement should, where reasonably possible, first be addressed through good-faith discussion between the parties before formal legal proceedings are considered.

24. ACCEPTANCE OF ENGAGEMENT

By accepting this agreement electronically through the AAICBI Instructor Portal, both parties confirm that they have read, understood, and agreed to the terms and conditions contained in this Letter of Engagement.

The instructor confirms that they understand their responsibilities concerning teaching, mentoring, attendance, communication, confidentiality, trainee information, intellectual property, and professional conduct.

FOR AAICBI / FUTYBILLS TECH
Sent by: {{SUPERVISOR_NAME}}
Date: {{LETTER_DATE}}

INSTRUCTOR
Full Name: {{INSTRUCTOR_NAME}}
Email: {{INSTRUCTOR_EMAIL}}
Phone Number: {{INSTRUCTOR_PHONE}}

Acceptance is recorded electronically the moment the instructor clicks "Accept and Sign Agreement" in the Instructor Portal, together with their typed full name, IP address, and timestamp as the digital signature.`;
