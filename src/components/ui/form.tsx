import { Slot } from "@radix-ui/react-slot"
import * as React from "react"
import {
	Controller,
	type ControllerProps,
	type FieldPath,
	type FieldValues,
	FormProvider,
	useFormContext,
} from "react-hook-form"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const Form = FormProvider

type FormFieldContextValue<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
	name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)

const FormField = <
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	...props
}: ControllerProps<TFieldValues, TName>) => {
	return (
		<FormFieldContext.Provider value={{ name: props.name }}>
			<Controller {...props} />
		</FormFieldContext.Provider>
	)
}

const useFormField = () => {
	const fieldContext = React.useContext(FormFieldContext)
	const { getFieldState, formState } = useFormContext()

	if (!fieldContext) {
		throw new Error("useFormField should be used within <FormField>")
	}

	const fieldState = getFieldState(fieldContext.name, formState)

	return {
		name: fieldContext.name,
		error: fieldState.error,
	}
}

const FormItem = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
	({ className, ...props }, ref) => (
		<div ref={ref} className={cn("space-y-2", className)} {...props} />
	),
)
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<
	React.ElementRef<typeof Label>,
	React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => {
	const { error } = useFormField()

	return (
		<Label
			ref={ref}
			className={cn(error ? "text-red-500" : "text-neutral-700", className)}
			{...props}
		/>
	)
})
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<
	React.ElementRef<typeof Slot>,
	React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
	const { error } = useFormField()
	return <Slot ref={ref} aria-invalid={Boolean(error)} {...props} />
})
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<HTMLParagraphElement, React.ComponentProps<"p">>(
	({ className, ...props }, ref) => (
		<p ref={ref} className={cn("text-xs text-neutral-500", className)} {...props} />
	),
)
FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<HTMLParagraphElement, React.ComponentProps<"p">>(
	({ className, children, ...props }, ref) => {
		const { error } = useFormField()
		const body = error ? String(error.message ?? "") : children

		if (!body) {
			return null
		}

		return (
			<p ref={ref} className={cn("text-xs text-red-500", className)} {...props}>
				{body}
			</p>
		)
	},
)
FormMessage.displayName = "FormMessage"

export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage }
