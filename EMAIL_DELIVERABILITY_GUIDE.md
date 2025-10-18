# 📧 Email Deliverability Guide - Hadi Books Store

## ✅ What We've Already Fixed:

1. ✅ Professional HTML email templates
2. ✅ Proper email headers (Reply-To, X-Entity-Ref-ID)
3. ✅ SPF, DKIM, DMARC records configured
4. ✅ Verified domain with Resend
5. ✅ Consistent branding across all emails

## 🚨 WHY EMAILS GO TO SPAM (And How to Fix It)

### **1. NEW DOMAIN - No Sending Reputation**
**Problem:** `hadibookstore.shop` is a new domain with zero sending history.
**Solution:** Warm up your domain gradually.

#### Domain Warm-Up Strategy:
- **Week 1:** Send 20-50 emails per day
- **Week 2:** Send 100-200 emails per day  
- **Week 3:** Send 500-1000 emails per day
- **Week 4+:** Normal volume

**Action Items:**
- ✅ Start with emails to your own addresses (hadibooksstore01@gmail.com)
- ✅ Ask family/friends to register and mark emails as "Not Spam"
- ✅ Avoid sending to unknown/purchased email lists

### **2. LOW ENGAGEMENT - No Opens/Clicks**
**Problem:** Gmail sees nobody opening your emails.
**Solution:** Get people to engage with your emails.

**Critical Actions:**
1. **Ask first 10-20 customers to:**
   - Mark email as "Not Spam" if it lands in spam
   - Move email from Spam to Inbox
   - Reply to the email
   - Add `noreply@hadibookstore.shop` to contacts

2. **In your website:**
   - Add note: "Check spam folder for OTP emails"
   - Add button: "Add us to your contacts"

### **3. DMARC POLICY TOO WEAK**
**Current:** `v=DMARC1; p=none;`
**Problem:** Not strict enough for Gmail/Yahoo

**Fix - Update Cloudflare DNS:**
```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=quarantine; pct=100; rua=mailto:hadibooksstore01@gmail.com; ruf=mailto:hadibooksstore01@gmail.com; fo=1; adkim=s; aspf=s
```

**What this does:**
- `p=quarantine` - Quarantine suspicious emails (stricter than `p=none`)
- `pct=100` - Apply to 100% of emails
- `adkim=s` - Strict DKIM alignment
- `aspf=s` - Strict SPF alignment
- `rua/ruf` - Send reports to your email

### **4. NO CUSTOM TRACKING DOMAIN**
**Problem:** Using Resend's default tracking URLs.
**Solution:** Set up custom tracking domain.

**In Resend Dashboard:**
1. Go to Settings → Domains → `hadibookstore.shop`
2. Click "Add Custom Tracking Domain"
3. Use: `track.hadibookstore.shop`
4. Add CNAME record in Cloudflare:
   ```
   Type: CNAME
   Name: track
   Content: [value from Resend]
   ```

### **5. CONTENT TRIGGERS**
**Avoid these words in subject/content:**
- ❌ "Free", "Winner", "Congratulations", "Click here", "Act now"
- ❌ All caps: "IMPORTANT", "URGENT"
- ❌ Too many exclamation marks!!!
- ❌ Misleading subject lines

**Our current subjects (GOOD):**
- ✅ "Account Verification OTP - Hadi Books Store"
- ✅ "Order Confirmation #abc123 - Hadi Books Store"
- ✅ "Password Reset OTP - Hadi Books Store"

## 🎯 IMMEDIATE ACTIONS TO TAKE NOW:

### Step 1: Update DMARC Record (5 minutes)
1. Go to Cloudflare DNS
2. Find TXT record: `_dmarc`
3. Update content to:
   ```
   v=DMARC1; p=quarantine; pct=100; rua=mailto:hadibooksstore01@gmail.com; ruf=mailto:hadibooksstore01@gmail.com; fo=1; adkim=s; aspf=s
   ```
4. Save and wait 5-10 minutes

### Step 2: Test Email Deliverability (10 minutes)
1. Go to: https://www.mail-tester.com/
2. Send a test email to the address they give you
3. Check your score (aim for 9+/10)
4. Fix any issues they report

### Step 3: Gmail Postmaster Tools (15 minutes)
1. Go to: https://postmaster.google.com/
2. Add domain: `hadibookstore.shop`
3. Verify ownership (add TXT record they give you)
4. Monitor: IP reputation, Domain reputation, Spam rate
5. **Goal:** Get "High" domain reputation

### Step 4: Ask First Customers for Help
Send this message to your first customers:

```
Hi [Name],

Thank you for registering with Hadi Books Store!

To ensure you receive our order confirmations and OTP emails, please:

1. Check your Spam folder
2. If our email is there, mark it as "Not Spam"
3. Add noreply@hadibookstore.shop to your contacts

This helps ensure our future emails reach your inbox.

Thank you!
Hadi Books Store Team
```

### Step 5: Monitor Resend Dashboard
1. Go to: https://resend.com/emails
2. Check email statuses:
   - ✅ **Delivered** = Good
   - ⚠️ **Bounced** = Bad email address
   - 🔴 **Complained** = Marked as spam

3. Track metrics:
   - **Open Rate:** Aim for > 20%
   - **Bounce Rate:** Keep < 5%
   - **Complaint Rate:** Keep < 0.1%

## 📊 MONITORING & TESTING

### Daily Checks:
- [ ] Check Resend dashboard for bounces/complaints
- [ ] Test order flow and check if email arrives in inbox
- [ ] Monitor Gmail Postmaster Tools (if enrolled)

### Weekly Checks:
- [ ] Review DMARC reports (check hadibooksstore01@gmail.com)
- [ ] Test with mail-tester.com
- [ ] Check domain reputation score

### Monthly Checks:
- [ ] Review overall deliverability rate
- [ ] Analyze engagement metrics
- [ ] Clean email list (remove bounces)

## 🔧 TECHNICAL CHECKLIST

### DNS Records (Verify in Cloudflare):
- [x] SPF: `v=spf1 include:amazonses.com ~all`
- [x] DKIM: `resend._domainkey` → [long key]
- [ ] DMARC: Update to strict policy (see Step 1 above)
- [x] MX: `send` → `feedback-smtp.ap-northeast-1.amazonses.com`

### Email Configuration:
- [x] From: `Hadi Books Store <noreply@hadibookstore.shop>`
- [x] Reply-To: `hadibooksstore01@gmail.com`
- [x] HTML + Plain Text versions
- [x] Proper headers (X-Entity-Ref-ID)
- [x] Professional templates
- [x] Mobile responsive

### Resend Settings:
- [x] Domain verified: `hadibookstore.shop`
- [ ] Custom tracking domain: `track.hadibookstore.shop` (optional)
- [x] Region: Asia Pacific (Tokyo)

## 📈 EXPECTED TIMELINE

- **Day 1-7:** Most emails may still go to spam (building reputation)
- **Week 2-3:** 50-70% should reach inbox
- **Week 4+:** 90%+ should reach inbox

## 🆘 IF EMAILS STILL GO TO SPAM AFTER 2 WEEKS:

1. **Check mail-tester.com score** - Should be 9+/10
2. **Check Gmail Postmaster** - Domain reputation should be "High"
3. **Review DMARC reports** - Check for alignment issues
4. **Contact Resend support** - They can check deliverability issues
5. **Consider professional email service** - SendGrid, Mailgun (paid but better reputation)

## 💡 PRO TIPS

1. **Send consistently** - Don't go from 0 to 1000 emails overnight
2. **Maintain clean list** - Remove bounced emails immediately
3. **Personalize emails** - Use customer's name
4. **Make unsubscribe easy** - Add unsubscribe link in footer
5. **Monitor feedback loops** - Act on spam complaints quickly
6. **Warm personal touch** - Include real person's name in From field
7. **Test before sending** - Always test with multiple email providers

## 📞 NEED HELP?

If deliverability doesn't improve:
1. Check Resend status page: https://resend.com/status
2. Contact Resend support: support@resend.com
3. Consider hiring email deliverability consultant

---

**Remember:** Building email reputation takes time. Be patient and follow best practices!
