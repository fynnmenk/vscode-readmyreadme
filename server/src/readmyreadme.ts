import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getDocumentSettings, Section } from './server';

type Headline = { headline: string; range: Range; };

//create Class for analyzing outline Structure
export class OutlineStructureValidator {
    //validate outline structure of a document
    public async validateOutlineStructure(textDocument: TextDocument): Promise<Diagnostic[]> {
        const settings = getDocumentSettings(textDocument.uri);
        const readMeHeadlines = this.getHeadlinesFromTextDocument(textDocument);
        const structureDiagnostics: Diagnostic[] = [];
        let missingSections = Object.entries((await settings).outlineStructure.sections).map(([key, value]) => value);

        readMeHeadlines.forEach((headline) => {
            let diagnosticAndMissingSections = this.analyzeTextDocumentHeadline(headline.headline, headline.range, missingSections);
            //update structureDiagnostics with found errors
            if (diagnosticAndMissingSections[0] != undefined) {
                structureDiagnostics.push(
                    diagnosticAndMissingSections[0]
                );
            }
            //update missing sections
            if (diagnosticAndMissingSections[1].length > 0) {
                missingSections = diagnosticAndMissingSections[1];
            }
        });

        //check if a headline is still missing
        missingSections.forEach((section, key) => {
            structureDiagnostics.push(
                this.createDiagnosticForMissingSections(section)
            );
        });

        return structureDiagnostics;
    }

    // get Headlines from TextDocument and return them as array with headline and range
    public getHeadlinesFromTextDocument(textDocument: TextDocument): Headline[] {
        const text = textDocument.getText();
        const pattern: RegExp = /(?<=(^## )).*/gm;
        let headlineArray: Headline[] = [];
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

    // analyze given headline and return diagnostic and missing sections
    public analyzeTextDocumentHeadline(headline: string, headlineRange: Range, missingSections: Section[]): [Diagnostic | void, Section[]] {
        let headlineMatch = false;

        //check if headline matches missing headlines out of settings
        missingSections.forEach((section, key) => {
            //check if headline matches keyword aslong no match is found
            if (headlineMatch === false) {
                let found = section.keywords.find((keyword) => {
                    return headline.toLowerCase().includes(keyword.toLowerCase());
                });
                if (found !== undefined) {
                    missingSections.splice(key, 1);
                    headlineMatch = true;
                }
            }
        });

        //create diagnostic if headline does not match
        if (!headlineMatch) {
            const diagnosticForHeadline: Diagnostic = {
                severity: DiagnosticSeverity.Warning,
                range: headlineRange,
                message: `This headline does not match the recommended outline structure.`,
                source: "readmyreadme.outline"
            };
            return [diagnosticForHeadline, missingSections];
        }
        //return empty diagnostic if headline matches
        return [undefined, missingSections];
    }

    //create diagnostic for missing sections
    public createDiagnosticForMissingSections(section: Section): Diagnostic {
        let sectionNameArray = Object.entries(section).filter(([key]) => key === "name");
        let sectionName = sectionNameArray[0][1];

        const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Warning,
            range: Range.create(0, 0, 0, 0),
            message: `The section ${sectionName} is missing. It is recommended to add it to your outline.`,
            source: "readmyreadme.outline"
        };
        return diagnostic;
    }
}