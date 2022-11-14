import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getDocumentSettings , Section} from './server';

//checks if headline in given textDocument matches the outline structure
export async function validateOutlineStructure(textDocument: TextDocument): Promise<Diagnostic[]> {
	const settings = await getDocumentSettings(textDocument.uri);
    
    const readMeHeadlines = getHeadlinesFromTextDocument(textDocument);    
    const structureDiagnostics: Diagnostic[] = [];

    let missingSections = Object.entries(settings.outlineStructure.sections).map(([key, value]) => value);
    //check if section is in document
    readMeHeadlines.forEach((headline) => {
        let diagnostic = analyzeTextDocumentHeadline(headline.headline, headline.range, missingSections);
        //update structureDiagnostics with found errors
        if(diagnostic[0]) {
            structureDiagnostics.push(
                diagnostic[0]
            );
        }
        //update missing sections
        if(diagnostic[1].length > 0) {
            missingSections = diagnostic[1];
        }   
    });

    //check if a headline is still missing
    missingSections.forEach((section, key) => {
        structureDiagnostics.push(
            createDiagnosticForMissingSections(section)
        );
    });

    return structureDiagnostics;
}

// analyze given headline and return diagnostic and missing sections
function analyzeTextDocumentHeadline(headline : string, headlineRange: Range, missingSections: Section[]): [Diagnostic | void, Section[]] {
    let headlineMatch = false;

    //check if headline matches missing headlines out of settings
    missingSections.forEach((section, key) => {
        section.keywords.forEach((keyword) => {
            //check if headline matches keyword aslong no match is found
            while (headlineMatch == false) {
                if(headline.toLowerCase().includes(keyword.toLowerCase())) {
                    missingSections.splice(key, 1);
                    headlineMatch = true;
                }
            }
        });
    });

    //create diagnostic if headline does not match
    if (!headlineMatch) {
        const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Warning,
			range: headlineRange,
            message: `This headline does not match the recommended outline structure.`,
            source: "outline"
        };
        return [diagnostic, missingSections];
    }
    //return empty diagnostic if headline matches
    return [undefined, missingSections];
}

//create diagnostic for missing sections
function createDiagnosticForMissingSections(section: Section): Diagnostic {
    let sectionNameArray = Object.entries(section).filter(([key]) => key === "name");
    let sectionName = sectionNameArray[0][1];
    
    const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: Range.create(0, 0, 0, 0),
        message: `The section ${sectionName} is missing. It is recommended to add it to your outline.`,
        source: "outline"
    };
    return diagnostic;
}

type Headline = { headline: string; range: Range; };

// get Headlines from TextDocument and return them as array with headline and range
function getHeadlinesFromTextDocument(textDocument: TextDocument) {
    const text = textDocument.getText();
    const pattern : RegExp = /(?<=(^#)\s).*/gm;;
    let headlineArray: Headline[]  = [];
    let m: RegExpExecArray | null;
    while (m = pattern.exec(text)) {
        const headline: Headline = {
            headline: m[0],
            range: Range.create(textDocument.positionAt(m.index), textDocument.positionAt(m.index + m[0].length))
        };
        headlineArray.push(headline);
    }
    return headlineArray;
}
