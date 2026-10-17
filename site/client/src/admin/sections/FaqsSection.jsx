import { Route, Routes, useParams } from 'react-router-dom'
import CollectionList from '../components/CollectionList'
import { FormSection, TextField } from '../components/fields'
import RecordEditor from '../components/RecordEditor'

function FaqEditor() {
  const { id } = useParams()
  return (
    <RecordEditor
      collection="faqs"
      id={id}
      backTo="/admin/faqs"
      backLabel="FAQs"
      noun="question"
      titleOf={(draft) => draft.question || 'New question'}
      previewPath={() => '/'}
      previewNote="FAQs are near the bottom of the Home page."
      renderFields={({ draft, update, errors }) => (
        <FormSection title="Question">
          <TextField label="Question" required value={draft.question} maxLength={300} error={errors.question}
            onChange={(question) => update({ question })} />
          <TextField label="Answer" required multiline rows={6} value={draft.answer} maxLength={2000} error={errors.answer}
            onChange={(answer) => update({ answer })} />
        </FormSection>
      )}
    />
  )
}

export default function FaqsSection() {
  return (
    <Routes>
      <Route
        index
        element={(
          <CollectionList
            collection="faqs"
            title="FAQs"
            description="Questions and answers shown on the Home page."
            noun="question"
            newDraft={{}}
            emptyText="No questions yet. Add the first one people usually ask."
            reorderHint="This is the order they appear on the Home page."
          />
        )}
      />
      <Route path=":id" element={<FaqEditor />} />
    </Routes>
  )
}
