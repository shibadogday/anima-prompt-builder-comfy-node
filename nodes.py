import json


def parse_state(state: str) -> tuple[str, str]:
    if state.strip() == "":
        return "", ""
    try:
        data = json.loads(state)
    except json.JSONDecodeError as error:
        raise ValueError(f"Cannot read the AniPro Builder state: {error}") from error
    if not isinstance(data, dict):
        raise ValueError("The AniPro Builder state has an invalid format")
    positive = data.get("positive", "")
    negative = data.get("negative", "")
    if not isinstance(positive, str) or not isinstance(negative, str):
        raise ValueError("The AniPro Builder state has an invalid format")
    return positive, negative


class AnimaPromptBuilder:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "state": ("STRING", {"default": "", "multiline": False}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("positive", "negative")
    FUNCTION = "build"
    CATEGORY = "conditioning"
    DESCRIPTION = "Outputs the prompt built with AniPro Builder."

    def build(self, state: str):
        return parse_state(state)


NODE_CLASS_MAPPINGS = {"AnimaPromptBuilder": AnimaPromptBuilder}
NODE_DISPLAY_NAME_MAPPINGS = {"AnimaPromptBuilder": "AniPro Builder"}
