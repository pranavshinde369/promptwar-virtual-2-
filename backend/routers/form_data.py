"""
routers/form_data.py – Static ECI Form knowledge base router.

All data is hard-coded from official ECI documentation so this router works
100% OFFLINE (edge-resilient) — zero Gemini API calls required.

This makes the service useful in areas with spotty internet:
  - The frontend can cache the form list and individual form steps via a
    service worker, enabling fully offline form guidance.
  - The Gemini-powered chatbot enhances the experience when online.

Routes:
  GET /api/v1/forms            – List all supported ECI forms
  GET /api/v1/forms/{form_id}  – Full step-by-step guide for a specific form
"""

import logging
from fastapi import APIRouter, HTTPException, status
from backend.models import FormInfo, FormListItem, FormStep

logger = logging.getLogger("lokmate.routers.form_data")

router = APIRouter(prefix="/forms", tags=["Form Knowledge Base (Offline)"])

# ---------------------------------------------------------------------------
# Knowledge base – structured from official ECI documentation
# ---------------------------------------------------------------------------

_FORMS: dict[str, FormInfo] = {
    "form-6": FormInfo(
        form_id="form-6",
        form_number="Form 6",
        title="New Voter Registration",
        purpose="Register as a voter for the first time in your constituency.",
        who_should_fill=(
            "Any Indian citizen who has turned 18 years old on or before "
            "January 1st of the qualifying year and is not yet registered."
        ),
        deadline_note="Submit at least 30 days before the voter list is finalised in your area.",
        steps=[
            FormStep(step_number=1, title="Visit the NVSP Portal", description="Go to https://voters.eci.gov.in and click 'New Registration (Form 6)'.", tip="You can also visit your nearest ERO (Electoral Registration Officer) office in person."),
            FormStep(step_number=2, title="Fill Personal Details", description="Enter your full name (as in Aadhaar/PAN), date of birth, gender, and mobile number.", tip="Name spellings must exactly match your official documents."),
            FormStep(step_number=3, title="Enter Your Address", description="Provide your ordinary place of residence — the address where you actually live, not a temporary address.", tip="You will need to prove this address with a document (see step 5)."),
            FormStep(step_number=4, title="Upload Your Photo", description="Upload a recent passport-size photograph (JPEG, max 2 MB). White or light-blue background preferred."),
            FormStep(step_number=5, title="Attach Address Proof", description="Upload ONE of: Aadhaar Card, Passport, Bank Passbook (with photo), Utility Bill (gas/electricity, recent), or Rent Agreement."),
            FormStep(step_number=6, title="Attach Age Proof", description="Upload ONE of: Birth Certificate, Class 10th Marksheet, Aadhaar Card (showing DOB), Passport."),
            FormStep(step_number=7, title="Submit the Form", description="Review all details carefully, then click Submit. You will receive an Application Reference Number (ARN) via SMS.", tip="Save the ARN — you can track your application status using it."),
            FormStep(step_number=8, title="Track & Receive Voter ID", description="Track your application at voters.eci.gov.in using your ARN. Your Voter Photo Identity Card (EPIC) will be dispatched by post or collected in person.", tip="You can also download a digital Voter ID from the DigiLocker app."),
        ],
        official_url="https://voters.eci.gov.in",
    ),
    "form-7": FormInfo(
        form_id="form-7",
        form_number="Form 7",
        title="Deletion or Objection in Electoral Roll",
        purpose="Object to the inclusion of a name in the voter list, or request deletion of your own name.",
        who_should_fill="Any registered voter who believes an entry in the electoral roll is incorrect, duplicate, or fraudulent.",
        deadline_note="Can be filed year-round; processed during the annual revision period.",
        steps=[
            FormStep(step_number=1, title="Identify the Entry", description="Note the serial number and part number of the entry you wish to object to from the electoral roll."),
            FormStep(step_number=2, title="Fill Form 7", description="Go to voters.eci.gov.in and select Form 7. Enter the details of the entry to be deleted and your reason."),
            FormStep(step_number=3, title="Provide Evidence", description="Attach supporting documents proving the entry is incorrect (e.g., death certificate for a deceased voter, or proof of relocation)."),
            FormStep(step_number=4, title="Submit and Track", description="Submit the form and note the ARN. The ERO will investigate and inform you of the outcome.", tip="Both parties (objector and the person objected to) may be called for a hearing."),
        ],
        official_url="https://voters.eci.gov.in",
    ),
    "form-8": FormInfo(
        form_id="form-8",
        form_number="Form 8",
        title="Correction of Entries / Shifting of Residence",
        purpose="Correct errors in your voter registration (name, address, photo) OR update your address after moving to a new constituency.",
        who_should_fill="Any registered voter who has moved to a different constituency, or has an error in their existing voter registration.",
        deadline_note="Submit as soon as possible after shifting. Processing takes 30–60 days.",
        steps=[
            FormStep(step_number=1, title="Select Reason on Form 8", description="On voters.eci.gov.in, open Form 8 and select your reason: 'Correction of entries' or 'Shifting of residence'."),
            FormStep(step_number=2, title="Enter New Details", description="If correcting name/DOB, provide the correct details and the corresponding proof document. If shifting, enter your new complete address."),
            FormStep(step_number=3, title="Attach New Address Proof", description="Upload proof for your NEW address: Aadhaar, recent utility bill, bank passbook, or rent agreement.", tip="The address on your proof must match what you wrote in the form exactly."),
            FormStep(step_number=4, title="Attach Photo (if needed)", description="If your current photo on the voter ID is outdated or incorrect, upload a new passport-size photograph."),
            FormStep(step_number=5, title="Submit and Note ARN", description="Submit the form and track progress with the ARN. Your name will be added to the electoral roll at the new address and removed from the old one.", tip="You CANNOT vote at your old booth once Form 8 is filed. Wait for the new EPIC."),
        ],
        official_url="https://voters.eci.gov.in",
    ),
    "form-8a": FormInfo(
        form_id="form-8a",
        form_number="Form 8A",
        title="Transposition within the Same Constituency",
        purpose="Update your address when you move within the SAME parliamentary/assembly constituency.",
        who_should_fill="Registered voters who have moved to a new area that is still within the same constituency.",
        deadline_note="Process is faster than Form 8 since no inter-constituency transfer is needed.",
        steps=[
            FormStep(step_number=1, title="Confirm Same Constituency", description="Verify that both your old and new addresses fall within the same assembly constituency. Use the 'Know Your Constituency' tool at voters.eci.gov.in.", tip="If your new address is in a DIFFERENT constituency, use Form 8 instead."),
            FormStep(step_number=2, title="Fill Form 8A", description="Enter your Voter ID number (EPIC), old address part/serial, and your complete new address within the same constituency."),
            FormStep(step_number=3, title="Attach New Address Proof", description="Upload address proof for the new location (Aadhaar, utility bill, rent agreement)."),
            FormStep(step_number=4, title="Submit", description="Submit and track with the ARN. Your polling booth will change but your Voter ID number stays the same."),
        ],
        official_url="https://voters.eci.gov.in",
    ),
    "form-6a": FormInfo(
        form_id="form-6a",
        form_number="Form 6A",
        title="Overseas (NRI) Voter Registration",
        purpose="Register as an overseas voter if you are an Indian citizen residing outside India.",
        who_should_fill="Indian citizens (holding Indian Passport) who are ordinarily residing abroad and have NOT acquired citizenship of another country.",
        deadline_note="File when your Indian passport is valid. Overseas voters must vote in person at the constituency of their last Indian address.",
        steps=[
            FormStep(step_number=1, title="Fill Form 6A Online", description="Go to voters.eci.gov.in → 'Overseas Voter (Form 6A)'. Enter your Indian Passport number and details."),
            FormStep(step_number=2, title="Provide Indian Address", description="Enter the address in India as mentioned in your Passport — this determines your constituency."),
            FormStep(step_number=3, title="Attach Documents", description="Upload: (a) Copy of valid Indian Passport, (b) Declaration of not acquiring foreign citizenship, (c) Recent passport-size photo."),
            FormStep(step_number=4, title="Submit via Indian Mission (Optional)", description="You can alternatively submit the form at your nearest Indian Embassy or High Commission abroad."),
        ],
        official_url="https://overseas.eci.gov.in",
    ),
}


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=list[FormListItem],
    summary="List all ECI forms",
    description="Returns a summary list of all supported ECI election forms. Works offline.",
)
async def list_forms() -> list[FormListItem]:
    """
    Return a summary of all forms in the knowledge base.

    Designed for offline/edge use — no external API calls.
    The frontend can cache this list in a service worker.
    """
    return [
        FormListItem(
            form_id=f.form_id,
            form_number=f.form_number,
            title=f.title,
            purpose=f.purpose,
        )
        for f in _FORMS.values()
    ]


@router.get(
    "/{form_id}",
    response_model=FormInfo,
    summary="Get step-by-step guide for a specific form",
    description="Returns full structured instructions for the requested ECI form. Works offline.",
    responses={404: {"description": "Form not found in knowledge base."}},
)
async def get_form(form_id: str) -> FormInfo:
    """
    Return full step-by-step guide for the requested form.

    Args:
        form_id: URL-safe form identifier (e.g. 'form-6', 'form-8').

    Raises:
        HTTPException 404: If the form_id is not in the knowledge base.
    """
    form = _FORMS.get(form_id.lower())
    if not form:
        supported = ", ".join(_FORMS.keys())
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form '{form_id}' not found. Supported forms: {supported}",
        )
    return form
