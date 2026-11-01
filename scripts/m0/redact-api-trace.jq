# Redact operator API trace JSON (fetch-api-trace.sh output).
def sensitive_key:
  test("^(latitude|longitude|lat|lng|koordinat|originalText|operatorDisplayText|message|body|note|text|plaintext|displayText|sosText)$"; "i");

def redact_string($s):
  if ($s | test("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}")) then "[REDACTED_EMAIL]"
  elif ($s | test("^[-+]?[0-9]{1,3}\\.[0-9]{4,}$")) then "[REDACTED_COORD]"
  elif ($s | test("^[0-9]{10,14}$")) then "[REDACTED_PHONE]"
  elif ($s | length) > 32 then "[REDACTED_TEXT]"
  else $s
  end;

def redact_value:
  if . == null then null
  elif type == "array" then map(redact_value)
  elif type == "object" then
    with_entries(
      if (.key | sensitive_key) then
        if (.value | type) == "number" then .value = "[REDACTED_COORD]"
        else .value = "[REDACTED_TEXT]"
        end
      else .value |= redact_value
      end
    )
  elif type == "string" then redact_string(.)
  else .
  end;

redact_value
