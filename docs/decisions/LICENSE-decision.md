# License Decision - Awaiting User Input

**Status:** PENDING  
**Date:** 2026-10-29  
**Context:** ADIM 05 (Monorepo Skeleton)

---

## Issue

The SOSMesh monorepo requires a clear license to define usage, modification, and distribution rights. No license type has been specified in the master plan or ADRs.

---

## Options

### 1. Open Source Licenses

**MIT License**
- ✅ Permissive, allows commercial use
- ✅ Simple, widely understood
- ✅ Compatible with most dependencies
- ❌ No copyleft protection

**Apache 2.0**
- ✅ Permissive with patent grant
- ✅ Protects contributors from patent claims
- ✅ Industry-standard
- ❌ More complex than MIT

**GPL v3**
- ✅ Strong copyleft (derivatives must be GPL)
- ✅ Protects against proprietary forks
- ❌ May limit commercial adoption
- ❌ Incompatible with some dependencies

**AGPL v3**
- ✅ GPL + network copyleft (SaaS must share source)
- ✅ Strongest protection for open source
- ❌ Can discourage commercial use
- ❌ May conflict with cloud hosting

### 2. Proprietary / Commercial License

**Custom Proprietary License**
- ✅ Full control over usage and distribution
- ✅ Can monetize
- ❌ Limits community contributions
- ❌ Requires legal drafting

**Dual License (e.g., AGPL + Commercial)**
- ✅ Open source for community, paid for commercial use
- ✅ Revenue model for sustainability
- ❌ Complex to enforce

### 3. Creative Commons (Documentation Only)

**CC BY 4.0** (for docs/content)
- ✅ Allows reuse with attribution
- ✅ Good for documentation and tutorials
- ❌ Not suitable for code

---

## Recommendation

**For Emergency/Public Safety Software:**

Given SOSMesh's public safety mission, we recommend:

1. **Code:** MIT or Apache 2.0 (permissive, encourages adoption by emergency services)
2. **Documentation:** CC BY 4.0 (knowledge sharing)

**Reasoning:**
- Emergency services may need to deploy/modify without copyleft restrictions
- Permissive licenses encourage integration with existing emergency systems
- Community contributions easier with permissive license

**Alternative:** If protecting against proprietary forks is priority, AGPL v3 ensures any hosted service shares source code.

---

## Decision

**Awaiting project owner input.**

---

## Next Steps

1. Project owner selects license type
2. Update `LICENSE` file with chosen license text
3. Add license headers to source files (if required by chosen license)
4. Update `package.json` `license` field
5. Document decision in this file

---

## Related

- Master Plan: (no license mention)
- ADRs: (no license ADR exists yet)
