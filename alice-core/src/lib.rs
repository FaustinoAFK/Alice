#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Mood {
    Calm,
    Curious,
    Supportive,
    Playful,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AliceReply {
    pub mood: Mood,
    pub text: String,
    pub follow_up: String,
}

pub fn detect_mood(input: &str) -> Mood {
    let normalized = input.trim().to_lowercase();

    if normalized.contains("triste")
        || normalized.contains("cansado")
        || normalized.contains("ansioso")
        || normalized.contains("difícil")
        || normalized.contains("dificil")
    {
        return Mood::Supportive;
    }

    if normalized.contains("?")
        || normalized.contains("como")
        || normalized.contains("por que")
        || normalized.contains("ideia")
    {
        return Mood::Curious;
    }

    if normalized.contains("haha")
        || normalized.contains("legal")
        || normalized.contains("jogo")
        || normalized.contains("brincar")
    {
        return Mood::Playful;
    }

    Mood::Calm
}

pub fn compose_reply(input: &str) -> AliceReply {
    let prompt = input.trim();
    let mood = detect_mood(prompt);

    if prompt.is_empty() {
        return AliceReply {
            mood: Mood::Calm,
            text: "Estou aqui com voce. Pode comecar do jeito que vier.".to_string(),
            follow_up: "O que voce quer pensar comigo agora?".to_string(),
        };
    }

    match mood {
        Mood::Supportive => AliceReply {
            mood,
            text: "Eu te acompanho com calma. Vamos diminuir o peso disso em partes pequenas."
                .to_string(),
            follow_up: "Qual e a menor parte dessa situacao que da para nomear primeiro?".to_string(),
        },
        Mood::Curious => AliceReply {
            mood,
            text: "Gosto dessa direcao. Parece que tem uma ideia querendo ganhar forma."
                .to_string(),
            follow_up: "Voce quer explorar possibilidades, organizar em passos ou transformar isso em um plano?"
                .to_string(),
        },
        Mood::Playful => AliceReply {
            mood,
            text: "Isso tem uma energia boa. Da para deixar mais leve sem perder o foco."
                .to_string(),
            follow_up: "Quer que eu entre mais no modo criativo ou no modo organizador?".to_string(),
        },
        Mood::Calm => AliceReply {
            mood,
            text: "Entendi. Vou ficar no seu ritmo e responder de forma simples.".to_string(),
            follow_up: "Quer me contar um pouco mais do que voce imaginou?".to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_supportive_mood_for_emotional_inputs() {
        assert_eq!(detect_mood("estou ansioso hoje"), Mood::Supportive);
    }

    #[test]
    fn detects_curious_mood_for_questions() {
        assert_eq!(
            detect_mood("como posso melhorar essa ideia?"),
            Mood::Curious
        );
    }

    #[test]
    fn composes_empty_reply_with_gentle_presence() {
        let reply = compose_reply("");

        assert_eq!(reply.mood, Mood::Calm);
        assert!(reply.text.contains("Estou aqui"));
    }

    #[test]
    fn composes_supportive_reply_with_follow_up() {
        let reply = compose_reply("isso esta dificil");

        assert_eq!(reply.mood, Mood::Supportive);
        assert!(reply.follow_up.contains("menor parte"));
    }
}
