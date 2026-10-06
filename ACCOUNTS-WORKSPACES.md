# Accounts and workspace access
Signup collects first/last name, email and a password of at least 12 characters. With configured email (mandatory production), verification precedes sign-in. Users create a workspace and finish organisation setup. Leave payment details blank during initial setup if MFA is not yet enrolled, then set them after authenticator verification.

OWNER/ADMIN production accounts must enroll TOTP before financial records open. Every MFA-enabled session needs server proof; a password-only or proofless session cannot read the workspace. Account security stays available for setup/verification. Sign-in presents a TOTP challenge or one-time recovery code. Recovery does not remove MFA or grant strong recent assurance.

Account name is editable; email change, account deletion, invitations and role editing are unavailable. Personal security shows token-free own sessions and can revoke other devices. Password reset requires configured delivery and revokes sessions. Passkeys are planned.

One user has one workspace membership. All ownership checks use current database membership; no client-selected tenant authority. Older local documents without an assigned workspace are deliberately inaccessible. Explicit browser-draft import preserves originals and does not overwrite newer server versions.
